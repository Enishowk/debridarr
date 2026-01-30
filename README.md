# Debridarr

An app that unlocks links with Alldebrid and downloads files.

## Screenshots

![App Screenshot](./screenshot.png)

## Deployment

To deploy this project with Docker, change the variables in docker-compose.yml and run

```bash
  docker compose up -d
```

Or

```bash
docker run -d \
  --name debridarr \
  -p 5173:5173 \
  -u $(id -u):$(id -g) \
  -e ALL_DEBRID_API_KEY=your_api_key_here \
  -e ROOT_PATH=/your_path \
  -e MOVIES_PATH=/movies \
  -e SERIES_PATH=/series \
  ghcr.io/enishowk/debridarr:latest
```

## Development

Copy the env file and modify the variables.

```bash
  cp .env.example .env 
```

Install dependencies.

```bash
  npm run install
  npm run dev
```
    
## License

[MIT](https://choosealicense.com/licenses/mit/)
