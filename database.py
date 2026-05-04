import sqlite3
from datetime import datetime

class Database:
    def __init__(self, db_name='sisvenda.db'):
        self.db_name = db_name
        self.init_db()

    def get_connection(self):
        conn = sqlite3.connect(self.db_name)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        conn = self.get_connection()
        cursor = conn.cursor()

        # Tabela de produtos
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS produtos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo TEXT UNIQUE NOT NULL,
                nome TEXT NOT NULL,
                descricao TEXT,
                preco REAL NOT NULL,
                estoque INTEGER DEFAULT 0,
                categoria TEXT,
                data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Tabela de clientes
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS clientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                email TEXT,
                telefone TEXT,
                cpf TEXT UNIQUE,
                endereco TEXT,
                data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Tabela de vendas
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS vendas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cliente_id INTEGER,
                data_venda TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                valor_total REAL NOT NULL,
                forma_pagamento TEXT,
                status TEXT DEFAULT 'concluida',
                FOREIGN KEY (cliente_id) REFERENCES clientes (id)
            )
        ''')

        # Tabela de itens da venda
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS itens_venda (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                venda_id INTEGER NOT NULL,
                produto_id INTEGER NOT NULL,
                quantidade INTEGER NOT NULL,
                preco_unitario REAL NOT NULL,
                subtotal REAL NOT NULL,
                FOREIGN KEY (venda_id) REFERENCES vendas (id),
                FOREIGN KEY (produto_id) REFERENCES produtos (id)
            )
        ''')

        conn.commit()
        conn.close()

    # Métodos CRUD para Produtos
    def adicionar_produto(self, codigo, nome, descricao, preco, estoque, categoria):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO produtos (codigo, nome, descricao, preco, estoque, categoria)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (codigo, nome, descricao, preco, estoque, categoria))
        conn.commit()
        produto_id = cursor.lastrowid
        conn.close()
        return produto_id

    def listar_produtos(self):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM produtos ORDER BY nome')
        produtos = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return produtos

    def buscar_produto(self, produto_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM produtos WHERE id = ?', (produto_id,))
        produto = cursor.fetchone()
        conn.close()
        return dict(produto) if produto else None

    def atualizar_produto(self, produto_id, dados):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE produtos 
            SET codigo=?, nome=?, descricao=?, preco=?, estoque=?, categoria=?
            WHERE id=?
        ''', (dados['codigo'], dados['nome'], dados['descricao'], 
              dados['preco'], dados['estoque'], dados['categoria'], produto_id))
        conn.commit()
        linhas_afetadas = cursor.rowcount
        conn.close()
        return linhas_afetadas > 0

    def deletar_produto(self, produto_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM produtos WHERE id = ?', (produto_id,))
        conn.commit()
        linhas_afetadas = cursor.rowcount
        conn.close()
        return linhas_afetadas > 0

    # Métodos CRUD para Clientes
    def adicionar_cliente(self, nome, email, telefone, cpf, endereco):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO clientes (nome, email, telefone, cpf, endereco)
            VALUES (?, ?, ?, ?, ?)
        ''', (nome, email, telefone, cpf, endereco))
        conn.commit()
        cliente_id = cursor.lastrowid
        conn.close()
        return cliente_id

    def listar_clientes(self):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM clientes ORDER BY nome')
        clientes = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return clientes

    def buscar_cliente(self, cliente_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM clientes WHERE id = ?', (cliente_id,))
        cliente = cursor.fetchone()
        conn.close()
        return dict(cliente) if cliente else None

    def atualizar_cliente(self, cliente_id, dados):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE clientes 
            SET nome=?, email=?, telefone=?, cpf=?, endereco=?
            WHERE id=?
        ''', (dados['nome'], dados['email'], dados['telefone'], 
              dados['cpf'], dados['endereco'], cliente_id))
        conn.commit()
        linhas_afetadas = cursor.rowcount
        conn.close()
        return linhas_afetadas > 0

    def deletar_cliente(self, cliente_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM clientes WHERE id = ?', (cliente_id,))
        conn.commit()
        linhas_afetadas = cursor.rowcount
        conn.close()
        return linhas_afetadas > 0

    # Métodos para Vendas
    def criar_venda(self, cliente_id, itens, forma_pagamento):
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Calcular valor total
            valor_total = sum(item['quantidade'] * item['preco_unitario'] for item in itens)
            
            # Inserir venda
            cursor.execute('''
                INSERT INTO vendas (cliente_id, valor_total, forma_pagamento)
                VALUES (?, ?, ?)
            ''', (cliente_id, valor_total, forma_pagamento))
            
            venda_id = cursor.lastrowid
            
            # Inserir itens e atualizar estoque
            for item in itens:
                subtotal = item['quantidade'] * item['preco_unitario']
                cursor.execute('''
                    INSERT INTO itens_venda (venda_id, produto_id, quantidade, preco_unitario, subtotal)
                    VALUES (?, ?, ?, ?, ?)
                ''', (venda_id, item['produto_id'], item['quantidade'], 
                      item['preco_unitario'], subtotal))
                
                # Atualizar estoque
                cursor.execute('''
                    UPDATE produtos 
                    SET estoque = estoque - ? 
                    WHERE id = ?
                ''', (item['quantidade'], item['produto_id']))
            
            conn.commit()
            return venda_id
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    def listar_vendas(self):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT v.*, c.nome as cliente_nome
            FROM vendas v
            LEFT JOIN clientes c ON v.cliente_id = c.id
            ORDER BY v.data_venda DESC
        ''')
        vendas = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return vendas

    def buscar_venda(self, venda_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Buscar venda
        cursor.execute('''
            SELECT v.*, c.nome as cliente_nome, c.cpf as cliente_cpf
            FROM vendas v
            LEFT JOIN clientes c ON v.cliente_id = c.id
            WHERE v.id = ?
        ''', (venda_id,))
        
        venda = cursor.fetchone()
        if not venda:
            conn.close()
            return None
        
        venda_dict = dict(venda)
        
        # Buscar itens da venda
        cursor.execute('''
            SELECT iv.*, p.nome as produto_nome, p.codigo as produto_codigo
            FROM itens_venda iv
            JOIN produtos p ON iv.produto_id = p.id
            WHERE iv.venda_id = ?
        ''', (venda_id,))
        
        venda_dict['itens'] = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        return venda_dict

    def cancelar_venda(self, venda_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Buscar itens da venda para restaurar estoque
            cursor.execute('SELECT produto_id, quantidade FROM itens_venda WHERE venda_id = ?', (venda_id,))
            itens = cursor.fetchall()
            
            # Restaurar estoque
            for item in itens:
                cursor.execute('''
                    UPDATE produtos 
                    SET estoque = estoque + ? 
                    WHERE id = ?
                ''', (item['quantidade'], item['produto_id']))
            
            # Cancelar venda
            cursor.execute('UPDATE vendas SET status = ? WHERE id = ?', ('cancelada', venda_id))
            
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    def relatorio_vendas_periodo(self, data_inicio, data_fim):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT v.*, c.nome as cliente_nome
            FROM vendas v
            LEFT JOIN clientes c ON v.cliente_id = c.id
            WHERE v.data_venda BETWEEN ? AND ?
            AND v.status = 'concluida'
            ORDER BY v.data_venda DESC
        ''', (data_inicio, data_fim))
        
        vendas = [dict(row) for row in cursor.fetchall()]
        
        # Calcular totais
        total_vendas = len(vendas)
        total_valor = sum(v['valor_total'] for v in vendas)
        
        conn.close()
        return {
            'total_vendas': total_vendas,
            'valor_total': total_valor,
            'vendas': vendas
        }
