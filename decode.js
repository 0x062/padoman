// bot.js - Versi Final (Tes Replay Sempurna)

import 'dotenv/config'
import { ethers, namehash } from 'ethers'

const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY
const REGISTRAR_ADDR = '0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175'

const REGISTRAR_ABI = [
  'function available(string) view returns (bool)',
  'function minCommitmentAge() view returns (uint256)',
  'function rentPrice(string,uint256) view returns (uint256)',
  'function commit(bytes32)',
  'function register(string name,address owner,uint256 duration,bytes32 secret,address resolver,bytes[] data,bool reverseRecord,uint16 ownerControlledFuses) payable'
]

const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL)
const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
const registrar = new ethers.Contract(REGISTRAR_ADDR, REGISTRAR_ABI, wallet)

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// --- DATA "CONTEKAN" DARI TRANSAKSI MANUAL ANDA YANG SUKSES ---
const knownGood = {
    owner: '0x52650ceDD2bEB608d6B7e94fccE78EA77A5a8987',
    duration: 31536000n,
    secret: '0x5de29eca00000003c808e71e1f77d546f1256ca159133b947e3208f77218b8df',
    resolver: '0x9a43dcA1C3BB268546b98eb2AB1401bFc5b58505',
    dataForResolver: ['0x8b95dd71f95e59a407bef0c1873b9a50ac25d6c1e141cee84cc03f7bfa0cbe94af4b56db00000000000000000000000000000000000000000000000000000000800a82300000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000001452650cedd2beb608d6b7e94fcce78ea77a5a8987000000000000000000000000'],
    reverseRecord: false,
    ownerControlledFuses: 0
};
// -------------------------------------------------------------

async function registerDomain(label) {
  const normalizedLabel = ethers.ensNormalize(label)
  console.log(`\n🚀 Mulai registrasi '${normalizedLabel}.phrs' (Mode Replay)`)

  if (!(await registrar.available(normalizedLabel))) throw new Error('Domain tidak tersedia')
  console.log('✅ Domain tersedia')
  
  // Membuat commitment HANYA menggunakan data "contekan", kecuali label
  const commitment = ethers.solidityPackedKeccak256(
    ['string', 'address', 'uint256', 'bytes32', 'address', 'bytes[]', 'bool', 'uint16'],
    [
        normalizedLabel,
        knownGood.owner,
        knownGood.duration,
        knownGood.secret, // Menggunakan secret yang sudah terbukti berhasil
        knownGood.resolver,
        knownGood.dataForResolver, // Menggunakan data resolver yang sudah terbukti berhasil
        knownGood.reverseRecord,
        knownGood.ownerControlledFuses
    ]
  );
  console.log(`[DEBUG] Replay Commitment Hash: ${commitment}`);

  console.log('1️⃣ Mengirim transaksi "commit"...')
  const txCommit = await registrar.commit(commitment) 
  await txCommit.wait()
  console.log(`✅ Commit berhasil, tx: ${txCommit.hash}`)

  const minWaitTime = await registrar.minCommitmentAge()
  const waitTimeWithBuffer = minWaitTime + 15n 
  console.log(`⏱  Menunggu ${waitTimeWithBuffer.toString()} detik...`)
  await sleep(Number(waitTimeWithBuffer) * 1000)

  const price = await registrar.rentPrice(normalizedLabel, knownGood.duration)
  const priceWithBuffer = (price * 105n) / 100n; 
  console.log(`[i] Harga dihitung: ${ethers.formatEther(priceWithBuffer)} PHRS`)
  
  console.log('2️⃣ Mengirim transaksi "register" (Mode Replay)...')
  const txRegister = await registrar.register(
    normalizedLabel,
    knownGood.owner,
    knownGood.duration,
    knownGood.secret,
    knownGood.resolver,
    knownGood.dataForResolver,
    knownGood.reverseRecord,
    knownGood.ownerControlledFuses,
    { 
      value: priceWithBuffer, 
      gasLimit: 500000 
    }
  )

  await txRegister.wait()
  console.log(`\n🎉 DOMAIN BERHASIL TERDAFTAR!`)
  console.log(`   Tx Hash: ${txRegister.hash}`)
}

// Ganti dengan label baru yang belum pernah Anda daftarkan
const newLabel = 'finalreplaytest' 
registerDomain(newLabel).catch(err => {
  console.error('\n🔥🔥🔥 GAGAL 🔥🔥🔥')
  console.error(`   - Pesan Singkat: ${err.reason || err.message}`)
  console.error('   - Detail Error Lengkap:', err) 
})
