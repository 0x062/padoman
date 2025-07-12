// bot.js - versi final untuk Ethers v6
import 'dotenv/config'
import { ethers, Interface, isError } from 'ethers'

const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY

const REGISTRAR_ADDR = '0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175'
const PUBLIC_RESOLVER = '0x9a43dcA1C3BB268546b98eb2AB1401bFc5b58505'

// ABI yang digunakan
const REGISTRAR_ABI = [
  'function available(string) view returns (bool)',
  'function commitments(bytes32) view returns (uint256)',
  'function minCommitmentAge() view returns (uint256)',
  'function rentPrice(string,uint256) view returns (uint256)',
  'function commit(bytes32)',
  'function register(string,address,uint256,bytes32,address,bytes[],bool,uint16) payable',
]
const RESOLVER_ABI = ['function setAddr(bytes32 node, address a)']

const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL)
const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
const registrar = new ethers.Contract(REGISTRAR_ADDR, REGISTRAR_ABI, wallet)

const sleep = (ms) => new Promise((res) => setTimeout(res, ms))

const secret = ethers.randomBytes(32) // 32-byte buffer yang sama

async function registerDomain(label) {
  const owner = await wallet.getAddress()
  const duration = 31536000 // 1 tahun
  const full = `${label}.phrs`
  const node = ethers.namehash(full)

  console.log(`🚀 Mulai registrasi '${full}'`)

  const available = await registrar.available(label)
  if (!available) throw new Error('Domain tidak tersedia')
  console.log('✅ Domain tersedia')

  const commitment = ethers.solidityPackedKeccak256(['string', 'address', 'bytes32'], [label, owner, secret])
  const txCommit = await registrar.commit(commitment)
  await txCommit.wait()
  console.log(`✅ Commit tx: ${txCommit.hash}`)

  const commitTime = await registrar.commitments(commitment)
  const current = await provider.getBlock('latest')
  const minWait = Number(await registrar.minCommitmentAge())
  const waitSec = Math.max(0, minWait - (current.timestamp - Number(commitTime))) + 15

  console.log(`⏱ Menunggu ${waitSec} detik...`)
  await sleep(waitSec * 1000)

  const price = await registrar.rentPrice(label, duration)

  const resolverInterface = new Interface(RESOLVER_ABI)
  const data = [resolverInterface.encodeFunctionData('setAddr', [node, owner])]
  console.log('✅ Data payload siap:', data)

  console.log('🔍 Pre-check callStatic.register...')
  try {
    await registrar.callStatic.register(label, owner, duration, secret, PUBLIC_RESOLVER, data, false, 0, {
      value: price,
    })
  } catch (err) {
    console.error('\n🔥🔥🔥 GAGAL 🔥🔥🔥')
    console.error('   - Pesan:', isError(err) ? err.message : err)
    return
  }

  console.log('🚀 Transaksi register dikirim...')
  const tx = await registrar.register(label, owner, duration, secret, PUBLIC_RESOLVER, data, false, 0, {
    value: price,
  })
  await tx.wait()

  console.log(`🎉 Sukses! Domain '${full}' terdaftar.`)
  console.log(`🔗 Tx: ${tx.hash}`)
}

registerDomain('gunayuku').catch((err) => {
  console.error('❌ Fatal error:', err.message)
})
