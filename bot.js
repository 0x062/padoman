// bot.js - Versi Final dengan BigInt

import 'dotenv/config'
import { ethers, namehash, Interface } from 'ethers'

const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY
const REGISTRAR_ADDR = '0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175'
const PUBLIC_RESOLVER = '0x9a43dcA1C3BB268546b98eb2AB1401bFc5b58505'

const REGISTRAR_ABI = [
  'function available(string) view returns (bool)',
  'function minCommitmentAge() view returns (uint256)',
  'function rentPrice(string,uint256) view returns (uint256)',
  'function Commit(bytes32)',
  'function multicall(bytes[]) payable',
  'function Register(string,address,uint256,bytes32,address,bytes[],bool,uint16) payable'
]
const RESOLVER_ABI = ['function setAddr(bytes32 node, address a)']

const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL)
const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
const registrar = new ethers.Contract(REGISTRAR_ADDR, REGISTRAR_ABI, wallet)
const registrarInterface = new Interface(REGISTRAR_ABI)
const resolverInterface = new Interface(RESOLVER_ABI)

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
// ✅ Rahasia tetap dalam bentuk bytes32
const secret = ethers.randomBytes(32)

async function registerDomain(label) {
  const owner = await wallet.getAddress()
  // ✅ Durasi sekarang adalah BigInt
  const duration = 31536000n 
  const fullName = `${label}.phrs`
  const node = namehash(fullName)

  console.log(`\n🚀 Mulai registrasi '${fullName}'`)

  if (!(await registrar.available(label))) throw new Error('Domain tidak tersedia')
  console.log('✅ Domain tersedia')

  const commitment = ethers.solidityPackedKeccak256(['string', 'address', 'bytes32'], [label, owner, secret])

  console.log('1️⃣ Mengirim transaksi "Commit" langsung...')
  const txCommit = await registrar.Commit(commitment)
  await txCommit.wait()
  console.log(`✅ Commit berhasil, tx: ${txCommit.hash}`)

  // ✅ Kalkulasi waktu tunggu menggunakan BigInt
  const minWaitTime = await registrar.minCommitmentAge()
  const waitTimeWithBuffer = minWaitTime + 15n // Menambah 15 detik (sebagai BigInt)
  console.log(`⏱  Menunggu ${waitTimeWithBuffer.toString()} detik...`)
  // ✅ Konversi ke Number hanya saat dibutuhkan oleh setTimeout
  await sleep(Number(waitTimeWithBuffer) * 1000)

  // ✅ Variabel `price` sudah otomatis menjadi BigInt dari ethers.js
  const price = await registrar.rentPrice(label, duration)
  console.log(`[DEBUG] Harga sewa yang dihitung: ${ethers.formatEther(price)} PHRS`)
  
  const dataForResolver = [resolverInterface.encodeFunctionData('setAddr', [node, owner])]
  const registerCallData = registrarInterface.encodeFunctionData('Register', [
    label, owner, duration, secret, PUBLIC_RESOLVER,
    dataForResolver, false, 0
  ])
  console.log('✅ Data untuk Register siap dibungkus dalam multicall')

  console.log('2️⃣ Mengirim transaksi "multicall(Register)"...')
  const txRegister = await registrar.multicall([registerCallData], { 
    value: price, // `price` sudah BigInt, aman
    gasLimit: 500000 
  })

  await txRegister.wait()
  console.log(`\n🎉 DOMAIN BERHASIL TERDAFTAR!`)
  console.log(`   Tx Hash: ${txRegister.hash}`)
}

// Ganti label dan jalankan
const newLabel = 'partnerjara2'
registerDomain(newLabel).catch(err => {
  console.error('\n🔥🔥🔥 GAGAL 🔥🔥🔥')
  console.error(`   - Pesan Singkat: ${err.reason || err.message}`)
  console.error('   - Detail Error Lengkap:', err) 
})
