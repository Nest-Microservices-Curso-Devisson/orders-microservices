<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

## Dev
1. Clonar el repositorio
2. Instalar dependencias `npm install`
3. Crear un archivo `.env` basado en el `env.template`
4. Ejecutar migracion de prisma `npx prisma migrate dev`
5. Ejecutar contenedor para correr la BD `docker compose up -d`
6. Levantar el servidor de NATS
```
docker run -d --name nats-server -p 4222:4222 -p 8222:8222 nats
```
7. Ejecutar `npm run start:dev`