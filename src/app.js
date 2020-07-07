import express from 'express';
import { accountModel } from './account.js';

const app = express();

app.use(express.json());
app.listen(3000, () => console.log('API Iniciada'));

app.patch('/depositar', async (req, res) => {
  try {
    const tipo = 'deposito';
    const { agencia, conta, valor } = req.body;
    let cliente = await buscarCliente(agencia, conta, null);
    validar(cliente, conta, valor, 0, tipo);
    transar(cliente, valor, 0, tipo);
    console.log(cliente);
    await accountModel.updateOne({ _id: cliente._id }, cliente);
    res.send(JSON.stringify(cliente.balance));
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.patch('/sacar', async (req, res) => {
  try {
    const taxa = 1;
    const tipo = 'saque';
    const { agencia, conta, valor } = req.body;
    let cliente = await buscarCliente(agencia, conta, null);
    validar(cliente, conta, valor, taxa, tipo);
    transar(cliente, valor, taxa, tipo);
    await accountModel.updateOne({ _id: cliente._id }, cliente);
    res.send(JSON.stringify(cliente.balance));
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.patch('/transferir', async (req, res) => {
  try {
    const { origem, destino, valor } = req.body;
    const clienteOrigem = await buscarCliente(null, origem, null);
    const clienteDestino = await buscarCliente(null, destino, null);
    let taxaTransferencia = 0;
    if (
      clienteOrigem &&
      clienteDestino &&
      clienteOrigem.agencia !== clienteDestino.agencia
    ) {
      taxaTransferencia = 8;
    }
    validar(clienteOrigem, origem, valor, taxaTransferencia, 'saque');
    validar(clienteDestino, destino, valor, 0, 'deposito');

    transar(clienteOrigem, valor, taxaTransferencia, 'saque');
    transar(clienteDestino, valor, 0, 'deposito');

    await accountModel.updateOne({ _id: clienteOrigem._id }, clienteOrigem);
    await accountModel.updateOne({ _id: clienteDestino._id }, clienteDestino);

    res.send(JSON.stringify(clienteOrigem.balance));
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/media/:agencia', async (req, res) => {
  try {
    const agencia = req.params.agencia;
    const contas = await accountModel
      .aggregate([
        {
          $match: {
            agencia: Number.parseInt(agencia),
          },
        },
        {
          $group: {
            _id: '$agencia',
            media: {
              $avg: '$balance',
            },
          },
        },
      ])
      .exec();

    contas.forEach((c) => {
      buscarCliente(c._id, null, c.saldo);
    });

    res.send(JSON.stringify(contas[0].media));
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/pobres/:limit', async (req, res) => {
  try {
    const limite = req.params.limit;
    const contas = await accountModel
      .find({}, { _id: 0, agencia: 1, conta: 1, balance: 1 })
      .sort({ balance: 1 })
      .limit(Number.parseInt(limite))
      .exec();
    res.send(JSON.stringify(contas));
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/ricos/:limit', async (req, res) => {
  try {
    const limite = req.params.limit;
    const contas = await accountModel
      .find({}, { _id: 0, agencia: 1, conta: 1, name: 1, balance: 1 })
      .sort({ balance: -1, name: 1 })
      .limit(Number.parseInt(limite))
      .exec();
    res.send(JSON.stringify(contas));
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.put('/private', async (req, res) => {
  try {
    const contas = await accountModel
      .aggregate([
        {
          $group: {
            _id: '$agencia',
            saldo: {
              $max: '$balance',
            },
          },
        },
      ])
      .exec();

    const privates = [];

    for (let c of contas) {
      let rico = await buscarCliente(c._id, null, c.saldo);
      rico.agencia = '99';
      await accountModel.updateOne({ _id: rico._id }, rico);
      privates.push(rico);
    }

    res.send(JSON.stringify(privates));
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.delete('/delete', async (req, res) => {
  try {
    const { agencia, conta } = req.body;
    const cliente = await buscarCliente(agencia, conta, null);
    await accountModel.deleteOne(cliente);
    const count = await accountModel.countDocuments({ agencia: agencia });
    console.log(count);
    res.send('' + count);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/saldo/:agencia/:conta', async (req, res) => {
  try {
    const agencia = req.params.agencia;
    const conta = req.params.conta;
    const cliente = await buscarCliente(
      Number.parseInt(agencia),
      Number.parseInt(conta),
      null
    );
    validar(cliente, conta, null, null, null);
    res.send(JSON.stringify(cliente.balance));
  } catch (error) {
    res.status(500).send(error.message);
  }
});

async function buscarCliente(agencia, conta, saldo) {
  const query = {
    agencia: agencia,
    conta: conta,
    balance: saldo,
  };
  if (agencia === null) {
    delete query.agencia;
  }
  if (saldo === null) {
    delete query.balance;
  }
  if (conta === null) {
    delete query.conta;
  }
  return await accountModel.findOne(query);
}

function validar(cliente, conta, valor, taxa, tipo) {
  if (cliente === null) {
    throw new Error(`Cliente da conta ${conta} não encontrado`);
  }
  if (valor !== null && valor <= 0) {
    throw new Error(`O valor do ${tipo} não pode ser negativo`);
  }
  if (
    valor !== null &&
    taxa !== null &&
    valor + taxa > cliente.balance &&
    tipo === 'saque'
  ) {
    throw new Error(`Você não possui saldo suficiente para esta operação`);
  }
}

function transar(cliente, valor, taxa, tipo) {
  switch (tipo) {
    case 'deposito':
      cliente.balance += valor;
      break;
    case 'saque':
      cliente.balance -= valor + taxa;
      break;
    default:
      break;
  }
}
