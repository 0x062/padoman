// bot.js - Versi Final (Definitif)

import 'dotenv/config'
import { ethers, namehash, Interface } from 'ethers'

const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY
const REGISTRAR_ADDR = '0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175'
const PUBLIC_RESOLVER = '0x9a43dcA1C3BB268546b98eb2AB1401bFc5b58505'

// ✅ ABI dengan nama fungsi yang sudah 100% terkonfirmasi
const REGISTRAR_ABI = [
  'function available(string) view returns (bool)',
  'function minCommitmentAge() view returns (uint256)',
  'function rentPrice(string,uint256) view returns (uint256)',
  'function commit(bytes32)', // <-- NAMA FUNGSI YANG BENAR
  'function multicall(bytes[]) payable',
  'function register(string,address,uint256,bytes32,address,bytes[],bool,uint16) payable'
]
const RESOLVER_ABI = ['function setAddr(bytes32 node, address a)']

const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL)
const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
const registrar = new ethers.Contract(REGISTRAR_ADDR, REGISTRAR_ABI, wallet)
const registrarInterface = new Interface(REGISTRAR_ABI)
const resolverInterface = new Interface(RESOLVER_ABI)

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const secret = ethers.randomBytes(32)

async function registerDomain(label) {
  const owner = await wallet.getAddress()
  const duration = 31536000n 
  const normalizedLabel = ethers.ensNormalize(label)
  console.log(`[DEBUG] Label asli: '${label}', Setelah normalisasi: '${normalizedLabel}'`)

  const fullName = `${normalizedLabel}.phrs`
  const node = namehash(fullName)

  console.log(`\n🚀 Mulai registrasi '${fullName}'`)

  if (!(await registrar.available(normalizedLabel))) throw new Error('Domain tidak tersedia')
  console.log('✅ Domain tersedia')

  const commitment = ethers.solidityPackedKeccak256(['string', 'address', 'bytes32'], [normalizedLabel, owner, secret])

  console.log('1️⃣ Mengirim transaksi "commit"...')
  // ✅ Memanggil fungsi dengan nama yang sudah terkonfirmasi benar
  const txCommit = await registrar.commit(commitment) 
  await txCommit.wait()
  console.log(`✅ Commit berhasil, tx: ${txCommit.hash}`)

  const minWaitTime = await registrar.minCommitmentAge()
  const waitTimeWithBuffer = minWaitTime + 15n 
  console.log(`⏱  Menunggu ${waitTimeWithBuffer.toString()} detik...`)
  await sleep(Number(waitTimeWithBuffer) * 1000)

  const price = await registrar.rentPrice(normalizedLabel, duration)
  console.log(`[DEBUG] Harga sewa yang dihitung: ${ethers.formatEther(price)} PHRS`)
  
  const dataForResolver = [resolverInterface.encodeFunctionData('setAddr', [node, owner])]
  const registerCallData = registrarInterface.encodeFunctionData('register', [
    normalizedLabel, owner, duration, secret, PUBLIC_RESOLVER,
    dataForResolver, false, 0
  ])
  console.log('✅ Data untuk Register siap dibungkus dalam multicall')

  console.log('2️⃣ Mengirim transaksi "multicall(register)"...')
  const txRegister = await registrar.multicall([registerCallData], { 
    value: price,
    gasLimit: 500000 
  })

  await txRegister.wait()
  console.log(`\n🎉 DOMAIN BERHASIL TERDAFTAR!`)
  console.log(`   Tx Hash: ${txRegister.hash}`)
}

// Ganti dengan label baru yang belum pernah dicoba
const newLabel = 'partnerjuarasukses' 
registerDomain(newLabel).catch(err => {
  console.error('\n🔥🔥🔥 GAGAL 🔥🔥🔥')
  console.error(`   - Pesan Singkat: ${err.reason || err.message}`)
  console.error('   - Detail Error Lengkap:', err) 
})
