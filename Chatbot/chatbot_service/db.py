import pymysql
from pymysql.cursors import DictCursor
from .config import settings


def get_connection():
    return pymysql.connect(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        password=settings.db_password,
        database=settings.db_name,
        cursorclass=DictCursor,
        autocommit=True,
    )


def fetch_all(query: str, params: tuple = ()):
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchall()


def fetch_one(query: str, params: tuple = ()):
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchone()


def execute(query: str, params: tuple = ()):
    with get_connection() as conn:
        with conn.cursor() as cursor:
            affected_rows = cursor.execute(query, params)
            return affected_rows
