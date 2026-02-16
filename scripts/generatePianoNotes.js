/**
 * Piano Note WAV Generator
 * 
 * Generates synthesized piano-like WAV files for each note from C1 to C7.
 * Uses additive synthesis with harmonics and a piano-like ADSR envelope.
 * 
 * Run: node scripts/generatePianoNotes.js
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const DURATION = 4.0;        // seconds per note (long enough for sustain pedal effect)
const BIT_DEPTH = 16;
const NUM_CHANNELS = 1;       // mono
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'piano');

// Note names for file naming
const NOTE_NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
const NOTE_DISPLAY = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

//Frequency Calculation:
// MIDI note number: C1 = 24, C7 = 96
// Frequency: f = 440 * 2^((midi - 69) / 12)
function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function envelope(t, duration) {
  const attack = 0.005;   // 5ms attack
  const decay = 0.1;      // 100ms initial decay
  const sustainLevel = 0.45;
  const releaseStart = duration - 0.5;
  
  if (t < attack) {
    // Attack phase
    return t / attack;
  } else if (t < attack + decay) {
    // Decay phase - exponential decay to sustain level
    const decayProgress = (t - attack) / decay;
    return 1.0 - (1.0 - sustainLevel) * decayProgress;
  } else if (t < releaseStart) {
    // Sustain phase - gentle exponential decay (like a real piano string ringing out)
    const sustainTime = t - (attack + decay);
    return sustainLevel * Math.exp(-sustainTime * 0.6);
  } else {
    // Release phase - fade to zero
    const releaseProgress = (t - releaseStart) / (duration - releaseStart);
    const currentLevel = sustainLevel * Math.exp(-(releaseStart - attack - decay) * 0.6);
    return currentLevel * (1.0 - releaseProgress * releaseProgress);
  }
}


function synthesizeNote(frequency, duration, sampleRate) {
  const numSamples = Math.floor(duration * sampleRate);
  const samples = new Float64Array(numSamples);
  
  // Harmonic amplitudes (relative to fundamental)
  // Real piano has strong fundamental, decreasing harmonics with some inharmonicity
  const harmonics = [
    { ratio: 1.0,    amp: 1.0 },    // Fundamental
    { ratio: 2.0,    amp: 0.5 },    // 2nd harmonic
    { ratio: 3.0,    amp: 0.25 },   // 3rd harmonic
    { ratio: 4.0,    amp: 0.15 },   // 4th harmonic
    { ratio: 5.0,    amp: 0.08 },   // 5th harmonic
    { ratio: 6.0,    amp: 0.04 },   // 6th harmonic
    { ratio: 7.0,    amp: 0.02 },   // 7th harmonic
    { ratio: 8.0,    amp: 0.01 },   // 8th harmonic
  ];
  
  // Piano inharmonicity: higher harmonics are slightly sharp
  // B = inharmonicity coefficient (increases with pitch)
  const B = 0.0001 * (frequency / 261.63); // Scale with frequency
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    for (const h of harmonics) {
      // Apply slight inharmonicity (real piano strings are not perfect)
      const harmonicFreq = frequency * h.ratio * Math.sqrt(1 + B * h.ratio * h.ratio);
      
      // Each harmonic decays at a different rate (higher = faster decay)
      const harmonicDecay = Math.exp(-t * h.ratio * 0.8);
      
      sample += h.amp * harmonicDecay * Math.sin(2 * Math.PI * harmonicFreq * t);
    }
    
    // Apply envelope
    sample *= envelope(t, duration);
    
    samples[i] = sample;
  }
  
  // Normalize to prevent clipping
  let maxAmp = 0;
  for (let i = 0; i < numSamples; i++) {
    maxAmp = Math.max(maxAmp, Math.abs(samples[i]));
  }
  if (maxAmp > 0) {
    const normFactor = 0.9 / maxAmp;  // Leave some headroom
    for (let i = 0; i < numSamples; i++) {
      samples[i] *= normFactor;
    }
  }
  
  return samples;
}

// Write WAV File
function writeWav(filepath, samples, sampleRate, bitDepth, numChannels) {
  const bytesPerSample = bitDepth / 8;
  const dataSize = samples.length * bytesPerSample * numChannels;
  const fileSize = 44 + dataSize; // 44 bytes for WAV header
  
  const buffer = Buffer.alloc(fileSize);
  let offset = 0;
  
  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;
  
  // fmt subchunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;           // Subchunk1Size (PCM = 16)
  buffer.writeUInt16LE(1, offset); offset += 2;            // AudioFormat (PCM = 1)
  buffer.writeUInt16LE(numChannels, offset); offset += 2;  // NumChannels
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;   // SampleRate
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, offset); offset += 4; // ByteRate
  buffer.writeUInt16LE(numChannels * bytesPerSample, offset); offset += 2; // BlockAlign
  buffer.writeUInt16LE(bitDepth, offset); offset += 2;     // BitsPerSample
  
  // data subchunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;
  
  // Write audio samples
  const maxVal = Math.pow(2, bitDepth - 1) - 1;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const intVal = Math.round(clamped * maxVal);
    buffer.writeInt16LE(intVal, offset);
    offset += bytesPerSample;
  }
  
  fs.writeFileSync(filepath, buffer);
}


function main() {
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Generate C1 (MIDI 24) to C7 (MIDI 96)
  const startMidi = 24;  // C1
  const endMidi = 96;    // C7
  
  let count = 0;
  const totalNotes = endMidi - startMidi + 1;
  
  console.log(`Generating ${totalNotes} piano notes (C1 to C7)...`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Sample rate: ${SAMPLE_RATE} Hz, Duration: ${DURATION}s, Bit depth: ${BIT_DEPTH}-bit`);
  console.log('');
  
  for (let midi = startMidi; midi <= endMidi; midi++) {
    const noteIndex = (midi - 24) % 12;
    const octave = Math.floor((midi - 12) / 12);
    const noteName = NOTE_NAMES[noteIndex];
    const noteDisplay = NOTE_DISPLAY[noteIndex];
    const filename = `${noteName}${octave}.wav`;
    const frequency = midiToFreq(midi);
    
    process.stdout.write(`  [${count + 1}/${totalNotes}] ${noteDisplay}${octave} (${frequency.toFixed(2)} Hz) -> ${filename} ... `);
    
    const samples = synthesizeNote(frequency, DURATION, SAMPLE_RATE);
    const filepath = path.join(OUTPUT_DIR, filename);
    writeWav(filepath, samples, SAMPLE_RATE, BIT_DEPTH, NUM_CHANNELS);
    
    const fileSize = fs.statSync(filepath).size;
    console.log(`${(fileSize / 1024).toFixed(1)} KB`);
    
    count++;
  }
  
  console.log('');
  console.log(`✓ Generated ${count} WAV files in ${OUTPUT_DIR}`);
  
  // Calculate total size
  let totalSize = 0;
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.wav'));
  for (const f of files) {
    totalSize += fs.statSync(path.join(OUTPUT_DIR, f)).size;
  }
  console.log(`  Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
}

main();
