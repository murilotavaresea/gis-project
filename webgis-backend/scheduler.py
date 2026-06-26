"""
Agendador de tarefas ETL.

Executa sincronizacoes periodicas de camadas locais sem depender de servico externo.
Configuracao via variaveis de ambiente:

  ETL_HORA_UTC   — hora UTC para rodar (default: 6, equivale a ~02:00 BRT)
  ETL_MINUTO     — minuto (default: 0)
  ETL_TABELAS    — tabelas separadas por virgula; vazio = todas (default: embargos_ibama)
"""

import logging
import os

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)


def _rodar_etl():
    tabelas_env = os.getenv("ETL_TABELAS", "embargos_ibama")
    tabelas = [t.strip() for t in tabelas_env.split(",") if t.strip()] or None

    logger.info("ETL agendado iniciando. Tabelas: %s", tabelas or "todas")
    try:
        from etl.sincronizar import sincronizar
        sincronizar(tabelas)
        logger.info("ETL agendado concluido com sucesso.")
    except Exception as e:
        logger.error("ETL agendado falhou: %s", e, exc_info=True)


def iniciar_scheduler():
    hora = int(os.getenv("ETL_HORA_UTC", "6"))
    minuto = int(os.getenv("ETL_MINUTO", "0"))

    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        _rodar_etl,
        trigger=CronTrigger(hour=hora, minute=minuto),
        id="etl_diario",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler iniciado. ETL diario agendado para %02d:%02d UTC.", hora, minuto)
    return scheduler
