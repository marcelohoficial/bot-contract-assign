import time
import os
import logging
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
import concurrent.futures
import random

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    filename='download_log.txt'
)
logger = logging.getLogger()

class ContractDownloader:
    def __init__(self, base_url, download_folder, max_workers=3, delay_between_ids=2, timeout=60):
        """
        Inicializa o downloader de contratos.
        
        Args:
            base_url: URL base do site, sem o ID
            download_folder: Pasta onde os downloads serão salvos
            max_workers: Número máximo de workers paralelos
            delay_between_ids: Tempo de espera entre processamento de IDs (segundos)
            timeout: Tempo máximo de espera para carregamento de elementos (segundos)
        """
        self.base_url = base_url
        self.download_folder = download_folder
        self.max_workers = max_workers
        self.delay_between_ids = delay_between_ids
        self.timeout = timeout
        
        # Garantir que a pasta de download existe
        os.makedirs(download_folder, exist_ok=True)
        
        # Lista para armazenar IDs processados com sucesso
        self.successful_ids = []
        # Lista para armazenar IDs que falharam
        self.failed_ids = []
        
    def setup_driver(self):
        """Configura e retorna uma instância do webdriver"""
        options = webdriver.ChromeOptions()
        
        # Configurações para otimizar o desempenho
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--no-sandbox")
        options.add_argument("--blink-settings=imagesEnabled=false")  # Desabilita imagens
        
        # Configurar pasta de download
        prefs = {
            "download.default_directory": os.path.abspath(self.download_folder),
            "download.prompt_for_download": False,
            "download.directory_upgrade": True,
            "safebrowsing.enabled": False
        }
        options.add_experimental_option("prefs", prefs)
        
        return webdriver.Chrome(options=options)
    
    def process_id(self, id_value):
        """Processa um único ID, acessando a página e baixando o arquivo"""
        driver = None
        try:
            logger.info(f"Iniciando processamento do ID: {id_value}")
            
            driver = self.setup_driver()
            
            # Acessa a URL com o ID
            url = f"{self.base_url}/{id_value}"
            driver.get(url)
            
            # Aguarda o botão de download aparecer
            wait = WebDriverWait(driver, self.timeout)
            download_button = wait.until(EC.element_to_be_clickable((By.ID, "download")))
            
            # Adiciona um pequeno delay aleatório para evitar sobrecarga do servidor
            time.sleep(random.uniform(0.5, 1.5))
            
            # Clica no botão de download
            download_button.click()
            
            # Aguarda um tempo para o download iniciar
            time.sleep(3)
            
            logger.info(f"Download iniciado para o ID: {id_value}")
            self.successful_ids.append(id_value)
            
            return True
            
        except TimeoutException:
            logger.error(f"Timeout ao processar ID {id_value} - página demorou muito para carregar")
            self.failed_ids.append(id_value)
            return False
            
        except NoSuchElementException:
            logger.error(f"Elemento não encontrado para ID {id_value}")
            self.failed_ids.append(id_value)
            return False
            
        except WebDriverException as e:
            logger.error(f"Erro do WebDriver para ID {id_value}: {str(e)}")
            self.failed_ids.append(id_value)
            return False
            
        except Exception as e:
            logger.error(f"Erro inesperado ao processar ID {id_value}: {str(e)}")
            self.failed_ids.append(id_value)
            return False
            
        finally:
            # Fecha o driver
            if driver:
                driver.quit()
                
            # Espera entre requests para não sobrecarregar o servidor
            time.sleep(self.delay_between_ids)
    
    def process_id_list(self, id_list, batch_size=100, pause_between_batches=30):
        """
        Processa uma lista de IDs em lotes, com pausas entre os lotes.
        
        Args:
            id_list: Lista de IDs a serem processados
            batch_size: Tamanho de cada lote
            pause_between_batches: Tempo de pausa entre lotes (segundos)
        """
        total_ids = len(id_list)
        logger.info(f"Iniciando processamento de {total_ids} IDs")
        
        # Dividir em lotes
        batches = [id_list[i:i + batch_size] for i in range(0, total_ids, batch_size)]
        
        for batch_index, batch in enumerate(batches):
            logger.info(f"Processando lote {batch_index + 1}/{len(batches)} com {len(batch)} IDs")
            
            # Processar lote atual com múltiplos workers
            with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                futures = {executor.submit(self.process_id, id_value): id_value for id_value in batch}
                
                for future in concurrent.futures.as_completed(futures):
                    id_value = futures[future]
                    try:
                        result = future.result()
                        status = "sucesso" if result else "falha"
                        logger.info(f"ID {id_value} processado com {status}")
                    except Exception as e:
                        logger.error(f"Erro ao processar ID {id_value}: {str(e)}")
                        self.failed_ids.append(id_value)
            
            # Mostrar progresso
            ids_processados = (batch_index + 1) * batch_size if (batch_index + 1) < len(batches) else total_ids
            progresso = (ids_processados / total_ids) * 100
            logger.info(f"Progresso: {progresso:.2f}% ({ids_processados}/{total_ids})")
            
            # Pausa entre lotes (exceto após o último lote)
            if batch_index < len(batches) - 1:
                logger.info(f"Pausa de {pause_between_batches} segundos antes do próximo lote...")
                time.sleep(pause_between_batches)
    
    def retry_failed_ids(self, max_retries=3):
        """Tenta novamente baixar os IDs que falharam"""
        if not self.failed_ids:
            logger.info("Não há IDs para tentar novamente.")
            return
        
        logger.info(f"Tentando novamente {len(self.failed_ids)} IDs que falharam...")
        
        for retry in range(max_retries):
            if not self.failed_ids:
                break
                
            logger.info(f"Tentativa {retry + 1}/{max_retries}")
            
            # Cria uma cópia da lista de falhas para iterar
            current_failed = self.failed_ids.copy()
            self.failed_ids = []  # Limpa a lista para esta tentativa
            
            # Processa os IDs que falharam
            for id_value in current_failed:
                success = self.process_id(id_value)
                if not success:
                    # Se ainda falhar, adiciona de volta à lista de falhas
                    self.failed_ids.append(id_value)
            
            logger.info(f"Após tentativa {retry + 1}, restam {len(self.failed_ids)} IDs com falha")
            
            # Pausa maior entre tentativas
            if self.failed_ids and retry < max_retries - 1:
                time.sleep(30)  # 30 segundos entre tentativas
    
    def get_results(self):
        """Retorna um resumo dos resultados"""
        return {
            "total_processados": len(self.successful_ids) + len(self.failed_ids),
            "sucesso": len(self.successful_ids),
            "falha": len(self.failed_ids),
            "ids_com_falha": self.failed_ids
        }


def ler_ids_do_excel(caminho_arquivo):
    """
    Lê os IDs da primeira coluna de um arquivo Excel, ignorando o cabeçalho.
    
    Args:
        caminho_arquivo: Caminho para o arquivo Excel
        
    Returns:
        Lista de IDs da primeira coluna
    """
    try:
        # Lê o arquivo Excel
        df = pd.read_excel(caminho_arquivo)
        
        # Pega todos os valores da primeira coluna (índice 0), começando da segunda linha (índice 1)
        ids = df.iloc[1:, 0].tolist()
        
        # Remove valores nulos e converte para o tipo correto
        ids = [int(id_) if isinstance(id_, (int, float)) else str(id_) for id_ in ids if not pd.isna(id_)]
        
        return ids
    except Exception as e:
        logger.error(f"Erro ao ler arquivo Excel: {str(e)}")
        return []


# Exemplo de uso
if __name__ == "__main__":
    # Configurações
    BASE_URL = "https://web-oxpay.netlify.app/contract/"  # Substitua pela URL base do seu site
    DOWNLOAD_FOLDER = "downloads"  # Pasta para salvar os downloads
    EXCEL_FILE = "teste-ativos.xlsx"  # Arquivo Excel com os IDs
    
    # Lê os IDs do arquivo Excel
    ids = ler_ids_do_excel(EXCEL_FILE)
    
    if not ids:
        logger.error("Nenhum ID encontrado no arquivo Excel ou ocorreu um erro ao ler o arquivo.")
        exit(1)
    
    logger.info(f"Foram encontrados {len(ids)} IDs no arquivo Excel.")
    
    # Inicializa o downloader
    downloader = ContractDownloader(
        base_url=BASE_URL,
        download_folder=DOWNLOAD_FOLDER,
        max_workers=3,  # Ajuste conforme necessário
        delay_between_ids=2,  # Segundos entre cada ID
        timeout=60  # Tempo máximo de espera para carregar a página
    )
    
    # Processa a lista de IDs em lotes
    downloader.process_id_list(
        id_list=ids,
        batch_size=100,  # Tamanho do lote
        pause_between_batches=30  # Pausa de 30 segundos entre lotes
    )
    
    # Tenta novamente para os IDs que falharam
    downloader.retry_failed_ids(max_retries=3)
    
    # Exibe resultados
    results = downloader.get_results()
    logger.info("Resumo do processamento:")
    logger.info(f"Total processado: {results['total_processados']}")
    logger.info(f"Sucesso: {results['sucesso']}")
    logger.info(f"Falha: {results['falha']}")
    
    if results['falha'] > 0:
        logger.info(f"IDs com falha: {results['ids_com_falha']}")
        
        # Salva os IDs com falha em um arquivo para processamento futuro
        with open('ids_falha.txt', 'w') as f:
            for id_value in results['ids_com_falha']:
                f.write(f"{id_value}\n")
        logger.info("IDs com falha salvos em 'ids_falha.txt'")