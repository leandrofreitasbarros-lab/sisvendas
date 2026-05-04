// API Configuration
const API_URL = '/api';

// Estado da Aplicação
let carrinho = [];
let produtoEditando = null;
let clienteEditando = null;

// ==================== FUNÇÕES UTILITÁRIAS ====================

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

function formatarData(data) {
    return new Date(data).toLocaleString('pt-BR');
}

function mostrarToast(mensagem, tipo = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = mensagem;
    toast.className = `toast ${tipo}`;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// ==================== NAVEGAÇÃO ====================

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Atualizar navegação
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // Mostrar página correta
        const pageName = item.dataset.page;
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.getElementById(`${pageName}-page`).classList.add('active');
        
        // Atualizar título
        document.getElementById('page-title').textContent = item.textContent.trim();
        
        // Carregar dados da página
        carregarPagina(pageName);
    });
});

function carregarPagina(pageName) {
    switch(pageName) {
        case 'dashboard':
            carregarDashboard();
            break;
        case 'vendas':
            carregarClientesSelect();
            break;
        case 'produtos':
            listarProdutos();
            break;
        case 'clientes':
            listarClientes();
            break;
        case 'relatorios':
            break;
    }
}

// ==================== DASHBOARD ====================

async function carregarDashboard() {
    try {
        // Carregar produtos e clientes para contagem
        const [produtosRes, clientesRes, vendasRes] = await Promise.all([
            fetch(`${API_URL}/produtos`),
            fetch(`${API_URL}/clientes`),
            fetch(`${API_URL}/vendas`)
        ]);
        
        const produtos = await produtosRes.json();
        const clientes = await clientesRes.json();
        const vendas = await vendasRes.json();
        
        // Atualizar cards
        document.getElementById('total-produtos').textContent = produtos.total;
        document.getElementById('total-clientes').textContent = clientes.total;
        
        // Calcular vendas de hoje
        const hoje = new Date().toISOString().split('T')[0];
        const vendasHoje = vendas.dados.filter(v => v.data_venda.startsWith(hoje));
        const valorHoje = vendasHoje.reduce((total, v) => total + v.valor_total, 0);
        
        document.getElementById('vendas-hoje').textContent = vendasHoje.length;
        document.getElementById('valor-hoje').textContent = formatarMoeda(valorHoje);
        
        // Últimas vendas
        const ultimasVendas = vendas.dados.slice(0, 5);
        const tbody = document.getElementById('ultimas-vendas');
        
        if (ultimasVendas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">Nenhuma venda registrada</td></tr>';
        } else {
            tbody.innerHTML = ultimasVendas.map(venda => `
                <tr>
                    <td>#${venda.id}</td>
                    <td>${venda.cliente_nome || 'Sem cliente'}</td>
                    <td>${formatarData(venda.data_venda)}</td>
                    <td>${formatarMoeda(venda.valor_total)}</td>
                    <td><span class="badge badge-${venda.status === 'concluida' ? 'success' : 'danger'}">${venda.status}</span></td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
}

// ==================== PDV / VENDAS ====================

async function buscarProduto() {
    const busca = document.getElementById('buscar-produto').value.trim();
    if (!busca) return;
    
    try {
        const response = await fetch(`${API_URL}/produtos`);
        const data = await response.json();
        
        const produto = data.dados.find(p => 
            p.codigo.toLowerCase() === busca.toLowerCase() ||
            p.nome.toLowerCase().includes(busca.toLowerCase())
        );
        
        const resultadoDiv = document.getElementById('resultado-busca');
        
        if (produto) {
            if (produto.estoque <= 0) {
                resultadoDiv.innerHTML = '<p style="color: red;">Produto sem estoque!</p>';
                return;
            }
            
            resultadoDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f5f5f5; border-radius: 5px;">
                    <div>
                        <strong>${produto.nome}</strong><br>
                        <small>Código: ${produto.codigo} | Estoque: ${produto.estoque}</small>
                    </div>
                    <div>
                        <strong>${formatarMoeda(produto.preco)}</strong>
                        <button class="btn btn-primary btn-sm" onclick="adicionarAoCarrinho(${produto.id}, '${produto.nome}', ${produto.preco})">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
            `;
        } else {
            resultadoDiv.innerHTML = '<p>Produto não encontrado</p>';
        }
    } catch (error) {
        mostrarToast('Erro ao buscar produto', 'error');
    }
}

function adicionarAoCarrinho(produtoId, nome, preco) {
    const itemExistente = carrinho.find(item => item.produto_id === produtoId);
    
    if (itemExistente) {
        itemExistente.quantidade++;
    } else {
        carrinho.push({
            produto_id: produtoId,
            nome: nome,
            preco_unitario: preco,
            quantidade: 1
        });
    }
    
    atualizarCarrinho();
    document.getElementById('buscar-produto').value = '';
    document.getElementById('resultado-busca').innerHTML = '';
}

function removerDoCarrinho(index) {
    carrinho.splice(index, 1);
    atualizarCarrinho();
}

function atualizarCarrinho() {
    const tbody = document.getElementById('carrinho-body');
    const totalSpan = document.getElementById('carrinho-total');
    
    if (carrinho.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">Carrinho vazio</td></tr>';
        totalSpan.textContent = formatarMoeda(0);
        return;
    }
    
    let total = 0;
    
    tbody.innerHTML = carrinho.map((item, index) => {
        const subtotal = item.preco_unitario * item.quantidade;
        total += subtotal;
        
        return `
            <tr>
                <td>${item.nome}</td>
                <td>
                    <input type="number" value="${item.quantidade}" min="1" 
                           onchange="alterarQuantidade(${index}, this.value)" 
                           style="width: 60px; padding: 5px;">
                </td>
                <td>${formatarMoeda(item.preco_unitario)}</td>
                <td>${formatarMoeda(subtotal)}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="removerDoCarrinho(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    totalSpan.textContent = formatarMoeda(total);
}

function alterarQuantidade(index, quantidade) {
    const qtd = parseInt(quantidade);
    if (qtd > 0) {
        carrinho[index].quantidade = qtd;
        atualizarCarrinho();
    }
}

async function carregarClientesSelect() {
    try {
        const response = await fetch(`${API_URL}/clientes`);
        const data = await response.json();
        
        const select = document.getElementById('cliente-venda');
        select.innerHTML = '<option value="">Venda sem cliente</option>' +
            data.dados.map(cliente => 
                `<option value="${cliente.id}">${cliente.nome}</option>`
            ).join('');
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
    }
}

async function finalizarVenda() {
    if (carrinho.length === 0) {
        mostrarToast('Adicione itens ao carrinho', 'error');
        return;
    }
    
    const clienteId = document.getElementById('cliente-venda').value;
    const formaPagamento = document.getElementById('forma-pagamento').value;
    
    const vendaData = {
        cliente_id: clienteId || null,
        itens: carrinho.map(item => ({
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario
        })),
        forma_pagamento: formaPagamento
    };
    
    try {
        const response = await fetch(`${API_URL}/vendas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vendaData)
        });
        
        const data = await response.json();
        
        if (data.sucesso) {
            mostrarToast('Venda realizada com sucesso!');
            carrinho = [];
            atualizarCarrinho();
            document.getElementById('cliente-venda').value = '';
        } else {
            mostrarToast(data.erro || 'Erro ao finalizar venda', 'error');
        }
    } catch (error) {
        mostrarToast('Erro ao finalizar venda', 'error');
    }
}

// ==================== PRODUTOS ====================

async function listarProdutos() {
    try {
        const
