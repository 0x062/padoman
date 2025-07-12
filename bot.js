// bot.js - Skrip Final dengan Dua Metode Panggilan

import 'dotenv/config'
import { ethers, namehash, Interface } from 'ethers'

const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY
const REGISTRAR_ADDR = '0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175'
const PUBLIC_RESOLVER = '0x9a43dcA1C3BB268546b98eb2AB1401bFc5b58505'

// ABI yang menggabungkan semua fungsi yang kita butuhkan
const REGISTRAR_ABI = [
  'function available(string) view returns (bool)',
  'function minCommitmentAge() view returns (uint256)',
  'function rentPrice(string,uint256) view returns (uint256)',
  // 'Commit' dengan C besar, sesuai bukti input data
  'function Commit(bytes32)',
  // 'multicall' dengan m kecil, sesuai bukti input data
  'function multicall(bytes[]) payable',
  // 'Register' dengan R besar, untuk di-encode di dalam multicall
  'function Register(string,address,uint256,bytes32,address,bytes[],bool,uint16) payable'
]

const RESOLVER_ABI = ['function setAddr(bytes32 node, address a)']

const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL)
const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
const registrar = new ethers.Contract(REGISTRAR_ADDR, REGISTRAR_ABI, wallet)
const registrarInterface = new Interface(REGISTRAR_ABI) // Digunakan untuk encode

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const secret = ethers.randomBytes(32)

async function registerDomain(label) {
  const owner = await wallet.getAddress()
  const duration = 31536000
  const fullName = `${label}.phrs`
  const node = namehash(fullName)

  console.log(`\n🚀 Mulai registrasi '${fullName}'`)

  if (!(await registrar.available(label))) throw new Error('Domain tidak tersedia')
  console.log('✅ Domain tersedia')

  const commitment = ethers.solidityPackedKeccak256(['string', 'address', 'bytes32'], [label, owner, secret])

  // --- Langkah 1: Panggilan COMMIT Langsung ---
  console.log('1️⃣ Mengirim transaksi "Commit" langsung...')
  const txCommit = await registrar.Commit(commitment)
  await txCommit.wait()
  console.log(`✅ Commit berhasil, tx: ${txCommit.hash}`)

  // --- Langkah 2: Menunggu ---
  const waitTime = Number(await registrar.minCommitmentAge()) + 15
  console.log(`⏱  Menunggu ${waitTime} detik...`)
  await sleep(waitTime * 1000)

  // --- Langkah 3: Panggilan REGISTER via Multicall ---
  const price = await registrar.rentPrice(label, duration)
  const resolverInterface = new Interface(RESOLVER_ABI)
  const dataForResolver = [resolverInterface.encodeFunctionData('setAddr', [node, owner])]

  // Encode data untuk fungsi 'Register'
  const registerCallData = registrarInterface.encodeFunctionData('Register', [
    label, owner, duration, secret, PUBLIC_RESOLVER,
    dataForResolver, false, 0
  ])
  console.log('✅ Data untuk Register siap dibungkus dalam multicall')

  console.log('2️⃣ Mengirim transaksi "multicall(Register)"...')
  const txRegister = await registrar.multicall(
    [registerCallData],
    { value: price }
  )

  await txRegister.wait()
  console.log(`\n🎉 DOMAIN BERHASIL TERDAFTAR!`)
  console.log(`   Tx Hash: ${txRegister.hash}`)
}

// --- EKSEKUSI ---
const newLabel = 'patnerjuaraselalu'
registerDomain(newLabel).catch(err => {
  console.error('\n🔥🔥🔥 GAGAL 🔥🔥🔥')
  console.error(`   - Pesan: ${err.reason || err.message}`)
})
