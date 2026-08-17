-- ==============================================================================
-- Atechabad Testing System (ATS) - Relational Database Schema
-- Run this query in phpMyAdmin (SQL tab) for MariaDB / MySQL
-- ==============================================================================

-- 1. Main Attempts Record Table
CREATE TABLE IF NOT EXISTS `attempts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `candidate_name` VARCHAR(255) DEFAULT 'Candidate',
    `candidate_roll` VARCHAR(100) DEFAULT 'ATS-2026-001',
    `total_score` DOUBLE NOT NULL,
    `max_score` INT NOT NULL,
    `percentage` DOUBLE NOT NULL,
    `grade` VARCHAR(10) NOT NULL,
    `pass_status` VARCHAR(20) NOT NULL,
    `time_taken_seconds` INT NOT NULL,
    `correct_count` INT NOT NULL,
    `wrong_count` INT NOT NULL,
    `skipped_count` INT NOT NULL,
    `longest_streak` INT DEFAULT 0,
    `strongest_subject` VARCHAR(255) DEFAULT NULL,
    `weakest_subject` VARCHAR(255) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Detailed Question Answers Table (Relational)
CREATE TABLE IF NOT EXISTS `attempt_answers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `attempt_id` INT NOT NULL,
    `question_id` VARCHAR(100) NOT NULL,
    `question_text` TEXT NOT NULL,
    `subject` VARCHAR(100) NOT NULL,
    `selected_option` TEXT,
    `correct_option` TEXT NOT NULL,
    `is_correct` TINYINT(1) NOT NULL,
    `explanation` TEXT,
    INDEX `idx_attempt_id` (`attempt_id`),
    CONSTRAINT `fk_answers_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Section Scores Breakdown Table (Relational)
CREATE TABLE IF NOT EXISTS `attempt_section_scores` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `attempt_id` INT NOT NULL,
    `subject` VARCHAR(100) NOT NULL,
    `total_questions` INT NOT NULL,
    `correct_count` INT NOT NULL,
    `wrong_count` INT NOT NULL,
    `percentage` DOUBLE NOT NULL,
    INDEX `idx_sec_attempt_id` (`attempt_id`),
    CONSTRAINT `fk_sections_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Application & Exam Settings Table
CREATE TABLE IF NOT EXISTS `settings` (
    `setting_key` VARCHAR(100) PRIMARY KEY,
    `setting_value` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Initial Default Settings Seed
INSERT INTO `settings` (`setting_key`, `setting_value`) VALUES 
('theme', 'light'),
('timer_sound', 'true'),
('font_size', 'medium'),
('shuffle_questions', 'true'),
('shuffle_options', 'true'),
('auto_submit', 'true')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);
