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
        const response = await fetch(`${API_URL}/produtos`);
        const data = await response.json();
        
        const tbody = document.getElementById('produtos-body');
        
        if (data.dados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">Nenhum produto cadastrado</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.dados.map(produto => `
            <tr>
                <td>${produto.codigo}</td>
                <td>${produto.nome}</td>
                <td>${formatarMoeda(produto.preco)}</td>
                <td>${produto.estoque}</td>
                <td>${produto.categoria || '-'}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="editarProduto(${produto.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deletarProduto(${produto.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        mostrarToast('Erro ao carregar produtos', 'error');
    }
}

function mostrarFormProduto() {
    document.getElementById('form-produto').classList.remove('hidden');
    document.getElementById('form-produto-titulo').textContent = 'Novo Produto';
    limparFormProduto();
}

function cancelarFormProduto() {
    document.getElementById('form-produto').classList.add('hidden');
    limparFormProduto();
    produtoEditando = null;
}

function limparFormProduto() {
    document.getElementById('produto-id').value = '';
    document.getElementById('produto-codigo').value = '';
    document.getElementById('produto-nome').value = '';
    document.getElementById('produto-descricao').value = '';
    document.getElementById('produto-preco').value = '';
    document.getElementById('produto-estoque').value = '';
    document.getElementById('produto-categoria').value = '';
}

async function salvarProduto() {
    const produtoData = {
        codigo: document.getElementById('produto-codigo').value,
        nome: document.getElementById('produto-nome').value,
        descricao: document.getElementById('produto-descricao').value,
        preco: parseFloat(document.getElementById('produto-preco').value),
        estoque: parseInt(document.getElementById('produto-estoque').value),
        categoria: document.getElementById('produto-categoria').value
    };
    
    if (!produtoData.codigo || !produtoData.nome || !produtoData.preco) {
        mostrarToast('Preencha os campos obrigatórios', 'error');
        return;
    }
    
    const produtoId = document.getElementById('produto-id').value;
    const url = produtoId ? `${API_URL}/produtos/${produtoId}` : `${API_URL}/produtos`;
    const method = produtoId ? 'PUT' : 'POST';
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(produtoData)
        });
        
        const data = await response.json();
        
        if (data.sucesso) {
            mostrarToast(produtoId ? 'Produto atualizado!' : 'Produto cadastrado!');
            cancelarFormProduto();
            listarProdutos();
        } else {
            mostrarToast(data.erro || 'Erro ao salvar produto', 'error');
        }
    } catch (error) {
        mostrarToast('Erro ao salvar produto', 'error');
    }
}

async function editarProduto(id) {
    try {
        const response = await fetch(`${API_URL}/produtos/${id}`);
        const data = await response.json();
        
        if (data.sucesso) {
            const produto = data.dados;
            document.getElementById('produto-id').value = produto.id;
            document.getElementById('produto-codigo').value = produto.codigo;
            document.getElementById('produto-nome').value = produto.nome;
            document.getElementById('produto-descricao').value = produto.descricao || '';
            document.getElementById('produto-preco').value = produto.preco;
            document.getElementById('produto-estoque').value = produto.estoque;
            document.getElementById('produto-categoria').value = produto.categoria || '';
            
            document.getElementById('form-produto').classList.remove('hidden');
            document.getElementById('form-produto-titulo').textContent = 'Editar Produto';
            produtoEditando = id;
        }
    } catch (error) {
        mostrarToast('Erro ao carregar produto', 'error');
    }
}

async function deletarProduto(id) {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    
    try {
        const response = await fetch(`${API_URL}/produtos/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.sucesso) {
            mostrarToast('Produto excluído!');
            listarProdutos();
        } else {
            mostrarToast(data.erro || 'Erro ao excluir produto', 'error');
        }
    } catch (error) {
        mostrarToast('Erro ao excluir produto', 'error');
    }
}

// ==================== CLIENTES ====================

async function listarClientes() {
    try {
        const response = await fetch(`${API_URL}/clientes`);
        const data = await response.json();
        
        const tbody = document.getElementById('clientes-body');
        
        if (data.dados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">Nenhum cliente cadastrado</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.dados.map(cliente => `
            <tr>
                <td>${cliente.nome}</td>
                <td>${cliente.email || '-'}</td>
                <td>${cliente.telefone || '-'}</td>
                <td>${cliente.cpf || '-'}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="editarCliente(${cliente.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deletarCliente(${cliente.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        mostrarToast('Erro ao carregar clientes', 'error');
    }
}

function mostrarFormCliente() {
    document.getElementById('form-cliente').classList.remove('hidden');
    document.getElementById('form-cliente-titulo').textContent = 'Novo Cliente';
    limparFormCliente();
}

function cancelarFormCliente() {
    document.getElementById('form-cliente').classList.add('hidden');
    limparFormCliente();
    clienteEditando = null;
}

function limparFormCliente() {
    document.getElementById('cliente-id').value = '';
    document.getElementById('cliente-nome').value = '';
    document.getElementById('cliente-email').value = '';
    document.getElementById('cliente-telefone').value = '';
    document.getElementById('cliente-cpf').value = '';
    document.getElementById('cliente-endereco').value = '';
}

async function salvarCliente() {
    const clienteData = {
        nome: document.getElementById('cliente-nome').value,
        email: document.getElementById('cliente-email').value,
        telefone: document.getElementById('cliente-telefone').value,
        cpf: document.getElementById('cliente-cpf').value,
        endereco: document.getElementById('cliente-endereco').value
    };
    
    if (!clienteData.nome) {
        mostrarToast('Nome é obrigatório', 'error');
        return;
    }
    
    const clienteId = document.getElementById('cliente-id').value;
    const url = clienteId ? `${API_URL}/clientes/${clienteId}` : `${API_URL}/clientes`;
    const method = clienteId ? 'PUT' : 'POST';
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clienteData)
        });
        
        const data = await response.json();
        
        if (data.sucesso) {
            mostrarToast(clienteId ? 'Cliente atualizado!' : 'Cliente cadastrado!');
            cancelarFormCliente();
            listarClientes();
        } else {
            mostrarToast(data.erro || 'Erro ao salvar cliente', 'error');
        }
    } catch (error) {
        mostrarToast('Erro ao salvar cliente', 'error');
    }
}

async function editarCliente(id) {
    try {
        const response = await fetch(`${API_URL}/clientes/${id}`);
        const data = await response.json();
        
        if (data.sucesso) {
            const cliente = data.dados;
            document.getElementById('cliente-id').value = cliente.id;
            document.getElementById('cliente-nome').value = cliente.nome;
            document.getElementById('cliente-email').value = cliente.email || '';
            document.getElementById('cliente-telefone').value = cliente.telefone || '';
            document.getElementById('cliente-cpf').value = cliente.cpf || '';
            document.getElementById('cliente-endereco').value = cliente.endereco || '';
            
            document.getElementById('form-cliente').classList.remove('hidden');
            document.getElementById('form-cliente-titulo').textContent = 'Editar Cliente';
            clienteEditando = id;
        }
    } catch (error) {
        mostrarToast('Erro ao carregar cliente', 'error');
    }
}

async function deletarCliente(id) {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
    
    try {
        const response = await fetch(`${API_URL}/clientes/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.sucesso) {
            mostrarToast('Cliente excluído!');
            listarClientes();
        } else {
            mostrarToast(data.erro || 'Erro ao excluir cliente', 'error');
        }
    } catch (error) {
        mostrarToast('Erro ao excluir cliente', 'error');
    }
}

// ==================== RELATÓRIOS ====================

async function gerarRelatorio() {
    const dataInicio = document.getElementById('data-inicio').value;
    const dataFim = document.getElementById('data-fim').value;
    
    if (!dataInicio || !dataFim) {
        mostrarToast('Selecione as datas', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/relatorios/vendas?data_inicio=${dataInicio}&data_fim=${dataFim}`);
        const data = await response.json();
        
        if (data.sucesso) {
            const relatorio = data.dados;
            
            document.getElementById('rel-total-vendas').textContent = relatorio.total_vendas;
            document.getElementById('rel-valor-total').textContent = formatarMoeda(relatorio.valor_total);
            
            const tbody = document.getElementById('relatorio-body');
            
            if (relatorio.vendas.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6">Nenhuma venda no período</td></tr>';
            } else {
                tbody.innerHTML = relatorio.vendas.map(venda => `
                    <tr>
                        <td>#${venda.id}</td>
                        <td>${venda.cliente_nome || 'Sem cliente'}</td>
                        <td>${formatarData(venda.data_venda)}</td>
                        <td>${formatarMoeda(venda.valor_total)}</td>
                        <td>${venda.forma_pagamento || '-'}</td>
                        <td>
                            <button class="btn btn-primary btn-sm" onclick="verDetalhesVenda(${venda.id})">
                                <i class="fas fa-eye"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (error) {
        mostrarToast('Erro ao gerar relatório', 'error');
    }
}

// ==================== MODAL DE DETALHES ====================

async function verDetalhesVenda(vendaId) {
    try {
        const response = await fetch(`${API_URL}/vendas/${vendaId}`);
        const data = await response.json();
        
        if (data.sucesso) {
            const venda = data.dados;
            const modal = document.getElementById('modal-venda');
            const content = document.getElementById('detalhes-venda-content');
            
            content.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <p><strong>Venda #${venda.id}</strong></p>
                    <p><strong>Data:</strong> ${formatarData(venda.data_venda)}</p>
                    <p><strong>Cliente:</strong> ${venda.cliente_nome || 'Sem cliente'}</p>
                    <p><strong>CPF:</strong> ${venda.cliente_cpf || '-'}</p>
                    <p><strong>Forma de Pagamento:</strong> ${venda.forma_pagamento || '-'}</p>
                    <p><strong>Status:</strong> <span class="badge badge-${venda.status === 'concluida' ? 'success' : 'danger'}">${venda.status}</span></p>
                </div>
                
                <h3>Itens da Venda</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Produto</th>
                            <th>Quantidade</th>
                            <th>Preço Unit.</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${venda.itens.map(item => `
                            <tr>
                                <td>${item.produto_nome}</td>
                                <td>${item.quantidade}</td>
                                <td>${formatarMoeda(item.preco_unitario)}</td>
                                <td>${formatarMoeda(item.subtotal)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3"><strong>Total</strong></td>
                            <td><strong>${formatarMoeda(venda.valor_total)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
                
                ${venda.status === 'concluida' ? `
                    <button class="btn btn-danger mt-20" onclick="cancelarVenda(${venda.id})">
                        <i class="fas fa-times"></i> Cancelar Venda
                    </button>
                ` : ''}
            `;
            
            modal.style.display = 'block';
        }
    } catch (error) {
        mostrarToast('Erro ao carregar detalhes da venda', 'error');
    }
}

function fecharModal() {
    document.getElementById('modal-venda').style.display = 'none';
}

async function cancelarVenda(vendaId) {
    if (!confirm('Tem certeza que deseja cancelar esta venda?')) return;
    
    try {
        const response = await fetch(`${API_URL}/vendas/${vendaId}/cancelar`, {
            method: 'PUT'
        });
        
        const data = await response.json();
        
        if (data.sucesso) {
            mostrarToast('Venda cancelada com sucesso!');
            fecharModal();
            carregarDashboard();
        } else {
            mostrarToast(data.erro || 'Erro ao cancelar venda', 'error');
        }
    } catch (error) {
        mostrarToast('Erro ao cancelar venda', 'error');
    }
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById('modal-venda');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// ==================== INICIALIZAÇÃO ====================

document.addEventListener('DOMContentLoaded', () => {
    carregarDashboard();
});
