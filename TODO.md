A medias:
[ ] Terminar de crear el processor y listener del PdfQueue
[ ] Crear la Queue del AIRecruiter y su processor, y lo demas que se necesite 

Estoy creando las Colas, necesito Crear las colas de pdf y de AiREcruiter, y con un EventLsitener de la cola de los pdf pasar ese pdf parseado a la del AiREcruiter

- El buffer del pdf es muy pesado como para anadirlo a una Queue
- Subir primero el pdf a un S3 y guardar el url en al Queue seria la solucion
- Pero lo ideal es subir el pdf al S3 directamente desde el cliente y no desde el servidor, para no ralentizar la request

## Posibles S3 providers:
- Cloudlfare R2
- Blackblaze B2
- Wasabi
- TG S3

El objetivo es que el backend no se acople a ninguno de estos sino solo a la api S3

## Seguridad de la url recibida

- !no puedo confiar en la URL recibida desde el cliente del supuesto PDF ya que es un riesgo de seguridad
  - Validar la url (dominio,extension,etc)
  - Validar el documetn type no solo por la extension sino con librerias especializadas
  - Definir tamano maximo de los archivos
