import time
import logging
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# Configurações
WEBDRIVER_PATH = 'caminho/para/seu/chromedriver'  # Altere para o caminho do seu WebDriver
BASE_URL = 'https://web-oxpay.netlify.app/contract'  # URL base do site
EXCEL_FILE = 'basepex-ativos.xlsx'  # Arquivo Excel com os IDs
DOWNLOAD_DIR = 'downloads'  # Diretório para salvar os arquivos
LOG_FILE = 'processo.log'  # Arquivo de log
PROGRESS_FILE = 'progresso.txt'  # Arquivo para salvar o progresso
DELAY_BETWEEN_REQUESTS = 5  # Intervalo entre requisições (em segundos)

# Configuração do logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)

# Função para configurar o Selenium
def setup_selenium():
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')  # Executa em modo headless (sem interface gráfica)
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument(f'--download.default_directory={DOWNLOAD_DIR}')
    driver = webdriver.Chrome(executable_path=WEBDRIVER_PATH, options=options)
    return driver

# Função para carregar os IDs do arquivo Excel
def load_ids_from_excel(file_path):
    try:
        df = pd.read_excel(file_path, header=None)  # Lê o arquivo Excel sem cabeçalho
        ids = df.iloc[1:, 0].tolist()  # Pega os IDs da coluna 1, a partir da segunda linha
        logging.info(f"Total de IDs carregados: {len(ids)}")
        return ids
    except Exception as e:
        logging.error(f"Erro ao carregar IDs do arquivo Excel: {e}")
        return []

# Função para salvar o progresso
def save_progress(last_processed_id, progress_file):
    with open(progress_file, 'w') as f:
        f.write(str(last_processed_id))
    logging.info(f"Progresso salvo: último ID processado = {last_processed_id}")

# Função para carregar o progresso
def load_progress(progress_file):
    try:
        with open(progress_file, 'r') as f:
            last_processed_id = f.read().strip()
            return last_processed_id if last_processed_id else None
    except FileNotFoundError:
        logging.warning("Arquivo de progresso não encontrado. Iniciando do início.")
        return None

# Função para fazer o download do arquivo
def download_file(driver, url, id):
    try:
        driver.get(url)
        # Espera o botão de download aparecer
        download_button = WebDriverWait(driver, 60).until(
            EC.presence_of_element_located((By.ID, 'download'))
        download_button.click()
        # Espera o download ser concluído (ajuste o tempo conforme necessário)
        time.sleep(10)
        logging.info(f"Download concluído para o ID: {id}")
    except TimeoutException:
        logging.error(f"Timeout ao acessar a página: {url}")
    except NoSuchElementException:
        logging.error(f"Botão de download não encontrado na página: {url}")
    except Exception as e:
        logging.error(f"Erro ao processar a página {url}: {e}")

# Função principal
def main():
    # Carrega os IDs do arquivo Excel
    ids = load_ids_from_excel(EXCEL_FILE)
    if not ids:
        return

    # Carrega o progresso anterior
    last_processed_id = load_progress(PROGRESS_FILE)
    start_index = ids.index(last_processed_id) + 1 if last_processed_id in ids else 0

    # Configura o Selenium
    driver = setup_selenium()

    # Processa cada ID
    for i in range(start_index, len(ids)):
        id = ids[i]
        url = f"{BASE_URL}{id}"
        logging.info(f"Processando ID: {id} ({i + 1}/{len(ids)})")
        download_file(driver, url, id)
        save_progress(id, PROGRESS_FILE)  # Salva o progresso
        time.sleep(DELAY_BETWEEN_REQUESTS)  # Intervalo entre requisições

    # Fecha o navegador
    driver.quit()
    logging.info("Processo concluído.")

if __name__ == "__main__":
    main()