## Creation of the DB

`docker exec -it pulse-postgres psql -U authuser -d authdb`

## Query to create users

`CREATE TABLE users ( id SERIAL PRIMARY KEY,username VARCHAR(255) UNIQUE NOT NULL,password_hash BYTEA NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`

## Exit psql

`\q`

## Launching

You should create .env file in the agent directory with your OpenAI api key.

Then:

`docker-compose up --build`
