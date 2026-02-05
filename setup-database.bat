@echo off
echo Setting up BuilderSpace Database...
echo.
echo Make sure PostgreSQL is installed and running!
echo.
set /p POSTGRES_PASSWORD="Enter your PostgreSQL postgres user password: "

echo Creating database...
psql -U postgres -h localhost -c "CREATE DATABASE builderspace;"

echo Database 'builderspace' created successfully!
echo.
echo Your database connection string should be:
echo postgresql://postgres:%POSTGRES_PASSWORD%@localhost:5432/builderspace
echo.
pause