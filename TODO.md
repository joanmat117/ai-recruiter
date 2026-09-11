
A medias:
[ ] Terminar de crear el processor y listener del PdfQueue
[ ] Crear la Queue del AIRecruiter y su processor, y lo demas que se necesite 

Estoy creando las Colas, necesito Crear las colas de pdf y de AiREcruiter, y con un EventLsitener de la cola de los pdf pasar ese pdf parseado a la del AiREcruiter

- El buffer del pdf es muy pesado como para anadirlo a una Queue
- Subir primero el pdf a un S3 y guardar el url en al Queue seria la solucion
- Pero lo ideal es subir el pdf al S3 directamente desde el cliente y no desde el servidor, para no ralentizar la request

## Implementar Drizzle y REpositoryPattern

-Implementar pgvector pa alamcenar los cvs spliteados y poner el id del cv en la metadata pa poder traerlo de la db sql. 
