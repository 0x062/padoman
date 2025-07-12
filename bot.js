// bot.js - Versi Final yang Disempurnakan

import 'dotenv/config'
import { ethers, namehash, Interface } from 'ethers'
// import { readFile } from 'fs/promises' // <-- Dihapus karena tidak digunakan

const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY
const REGISTRAR_ADDR = '0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175'
const PUBLIC_RESOLVER = '0x9a43dcA1C3BB268546b98eb2AB1401bFc5b58505'

const REGISTRAR_ABI = [
  'function available(string) view returns (bool)',
  'function commitments(bytes32) view returns (uint256)',
  'function minCommitmentAge() view returns (uint256)',
  'function rentPrice(string,uint256) view returns (uint256)',
  'function commit(bytes32)',
  'function register(string,address,uint256,bytes32,address,bytes[],bool,uint16) payable'
]

const RESOLVER_ABI = [
  'function setAddr(bytes32 node, address a)'
]

const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL)
const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
const registrar = new ethers.Contract(REGISTRAR_ADDR, REGISTRAR_ABI, wallet)
const resolverInterface = new Interface(RESOLVER_ABI)

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const secret = ethers.randomBytes(32)

async function registerDomain(label) {
  const owner = await wallet.getAddress()
  const duration = 31536000
  const fullName = `${label}.phrs`
  const node = namehash(fullName)

  console.log(`\n🚀 Mulai registrasi '${fullName}'`)

  const available = await registrar.available(label)
  if (!available) throw new Error('Domain tidak tersedia')
  console.log('✅ Domain tersedia')

  const commitment = ethers.solidityPackedKeccak256(
    ['string', 'address', 'bytes32'],
    [label, owner, secret]
  )

  const txCommit = await registrar.commit(commitment)
  await txCommit.wait()
  console.log(`✅ Commit tx: ${txCommit.hash}`)

  const commitTime = Number(await registrar.commitments(commitment))
  const now = (await provider.getBlock('latest')).timestamp
  
  // <-- PERBAIKAN: Konversi BigInt ke Number untuk kalkulasi yang aman
  const minWait = Number(await registrar.minCommitmentAge()) 
  const waitTime = Math.max(0, minWait - (now - commitTime)) + 15
  
  console.log(`⏱ Menunggu ${waitTime} detik...`)
  await sleep(waitTime * 1000)

  const price = await registrar.rentPrice(label, duration)

  const dataPayload = [
    resolverInterface.encodeFunctionData('setAddr', [node, owner])
  ]
  console.log('✅ Data payload siap:', dataPayload)

  // Pre-check
  console.log('🔍 Pre-check callStatic.register...')
  await registrar.callStatic.register(
    label,
    owner,
    duration,
    secret,
    PUBLIC_RESOLVER,
    dataPayload,
    false,
    0,
    { value: price }
  )

  const txRegister = await registrar.register(
    label,
    owner,
    duration,
    secret,
    PUBLIC_RESOLVER,
    dataPayload,
    false,
    0,
    { value: price }
  )

  await txRegister.wait()
  console.log(`\n🎉 DOMAIN BERHASIL TERDAFTAR!`)
  console.log(`🔗 TX HASH: ${txRegister.hash}`)
}

// Jalankan
const label = 'patnerterakhir'
registerDomain(label).catch(err => {
  console.error('\n🔥🔥🔥 GAGAL 🔥🔥🔥')
  console.error(`   - Pesan: ${err.reason || err.message}`)
})
