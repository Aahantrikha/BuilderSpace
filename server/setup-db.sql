-- BuilderSpace Database Setup
-- Run this script to create the database and user

-- Create database
CREATE DATABASE builderspace;

-- Create user (optional - you can use your existing postgres user)
CREATE USER builderspace_user WITH PASSWORD 'builderspace_password_2024';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE builderspace TO builderspace_user;

-- Connect to the builderspace database
\c builderspace;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO builderspace_user;