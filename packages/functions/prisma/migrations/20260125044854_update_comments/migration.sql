-- Prisma Database Comments Generator v1.4.0

-- Stored procedure to update column comments
DROP PROCEDURE IF EXISTS prisma_update_column_comment;

CREATE PROCEDURE prisma_update_column_comment(
    IN p_table_name VARCHAR(255),
    IN p_column_name VARCHAR(255),
    IN p_comment_text TEXT
)
BEGIN
    DECLARE column_definition TEXT;
    
    -- Get current column definition from current database
    SELECT CONCAT(
        COLUMN_TYPE,
        CASE WHEN IS_NULLABLE = 'NO' THEN ' NOT NULL' ELSE ' NULL' END,
        CASE WHEN COLUMN_DEFAULT IS NOT NULL THEN CONCAT(' DEFAULT ', QUOTE(COLUMN_DEFAULT)) ELSE '' END,
        CASE WHEN EXTRA != '' THEN CONCAT(' ', EXTRA) ELSE '' END
    ) INTO column_definition
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = p_table_name
        AND COLUMN_NAME = p_column_name;
    
    -- Build and execute ALTER statement
    SET @sql = CONCAT(
        'ALTER TABLE `', p_table_name, '`',
        ' MODIFY COLUMN `', p_column_name, '` ',
        column_definition,
        CASE 
            WHEN p_comment_text IS NULL THEN ''
            ELSE CONCAT(' COMMENT ', QUOTE(p_comment_text))
        END
    );
    
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END;

-- GanttRow comments
ALTER TABLE `GanttRow` COMMENT = 'ガント行';
CALL prisma_update_column_comment('GanttRow', 'label', '行ラベル');
CALL prisma_update_column_comment('GanttRow', 'createdBy', '作成者email');
CALL prisma_update_column_comment('GanttRow', 'updatedBy', '更新者email');

-- GanttTask comments
ALTER TABLE `GanttTask` COMMENT = 'ガントタスク';
CALL prisma_update_column_comment('GanttTask', 'rowId', '行ID');
CALL prisma_update_column_comment('GanttTask', 'name', 'タスク名');
CALL prisma_update_column_comment('GanttTask', 'start', '開始日時');
CALL prisma_update_column_comment('GanttTask', 'end', '終了日時');
CALL prisma_update_column_comment('GanttTask', 'createdBy', '作成者email');
CALL prisma_update_column_comment('GanttTask', 'updatedBy', '更新者email');

-- Drop stored procedure to update column comments
DROP PROCEDURE IF EXISTS prisma_update_column_comment;
