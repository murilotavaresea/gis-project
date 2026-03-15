import psycopg2
from psycopg2.extras import RealDictCursor

conn = psycopg2.connect(
    host="localhost",
    port="5432",
    database="webgis",
    user="postgres",
    password="687456",
    cursor_factory=RealDictCursor
)
