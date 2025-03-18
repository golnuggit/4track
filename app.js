// Global variables
let audioContext;
let tracks = [];
let isInitialized = false;
let countInInterval;
let currentlyRecordingTrack = null;
let mediaRecorder = null;
let recordedChunks = [];

// DOM Elements
const projectNameInput = document.getElementById('projectName');
const bpmInput = document.getElementById('bpmInput');
const recordButtons = document.querySelectorAll('.record-btn');
const stopButtons = document.querySelectorAll('.stop-btn');
const playButtons = document.querySelectorAll('.play-btn');
const deleteButtons = document.querySelectorAll('.delete-btn');
const volumeSliders = document.querySelectorAll('.volume-slider');
const panSliders = document.querySelectorAll('.pan-slider');
const playAllButton = document.getElementById('play-all-btn');
const stopAllButton = document.getElementById('stop-all-btn');
const exportButton = document.getElementById('export-btn');
const countInDisplay = document.getElementById('count-in-display');
const countValue = document.getElementById('count-value');

// Initialize the app
document.addEventListener('DOMContentLoaded', setupEventListeners);

// Set up event listeners
function setupEventListeners() {
    // Record buttons
    recordButtons.forEach(button => {
        button.addEventListener('click', () => {
            const trackId = parseInt(button.dataset.track);
            startRecording(trackId);
        });
    });

    // Stop buttons
    stopButtons.forEach(button => {
        button.addEventListener('click', () => {
            const trackId = parseInt(button.dataset.track);
            stopRecording(trackId);
        });
    });

    // Play buttons
    playButtons.forEach(button => {
        button.addEventListener('click', () => {
            const trackId = parseInt(button.dataset.track);
            playTrack(trackId);
        });
    });

    // Delete buttons
    deleteButtons.forEach(button => {
        button.addEventListener('click', () => {
            const trackId = parseInt(button.dataset.track);
            deleteTrack(trackId);
        });
    });

    // Volume sliders
    volumeSliders.forEach(slider => {
        slider.addEventListener('input', () => {
            const trackId = parseInt(slider.dataset.track);
            const value = parseFloat(slider.value);
            if (tracks[trackId - 1]) {
                tracks[trackId - 1].setVolume(value);
            }
        });
    });

    // Pan sliders
    panSliders.forEach(slider => {
        slider.addEventListener('input', () => {
            const trackId = parseInt(slider.dataset.track);
            const value = parseFloat(slider.value);
            if (tracks[trackId - 1]) {
                tracks[trackId - 1].setPan(value);
            }
        });
    });

    // Play all button
    playAllButton.addEventListener('click', playAllTracks);

    // Stop all button
    stopAllButton.addEventListener('click', stopAllTracks);

    // Export button
    exportButton.addEventListener('click', exportMix);
}

// Initialize the AudioContext and create track objects
async function initializeAudio() {
    try {
        // Create AudioContext
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Check for audio permissions
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Create tracks
        for (let i = 0; i < 4; i++) {
            tracks.push(new Track(i + 1, audioContext));
        }
        
        isInitialized = true;
        return true;
    } catch (error) {
        console.error('Error initializing audio:', error);
        alert('Could not access microphone. Please grant permission and try again.');
        return false;
    }
}

// Track class to manage individual audio tracks
class Track {
    constructor(id, audioContext) {
        this.id = id;
        this.audioContext = audioContext;
        this.audioBuffer = null;
        this.gainNode = audioContext.createGain();
        this.panNode = audioContext.createStereoPanner();
        this.isPlaying = false;
        this.isRecording = false;
        this.source = null;
        
        // Connect nodes
        this.gainNode.connect(this.panNode);
        this.panNode.connect(audioContext.destination);
        
        // Default values
        this.gainNode.gain.value = 1.0;
        this.panNode.pan.value = 0.0;
    }
    
    setVolume(value) {
        this.gainNode.gain.value = value;
    }
    
    setPan(value) {
        this.panNode.pan.value = value;
    }
    
    setAudioBuffer(buffer) {
        this.audioBuffer = buffer;
        
        // Update UI
        document.querySelector(`.play-btn[data-track="${this.id}"]`).disabled = false;
        document.querySelector(`.delete-btn[data-track="${this.id}"]`).disabled = false;
        
        // Simple visualization (just a color change for now)
        const waveform = document.getElementById(`waveform${this.id}`);
        waveform.style.backgroundColor = '#c8e6c9';
    }
    
    play() {
        if (!this.audioBuffer) return;
        
        if (this.isPlaying) this.stop();
        
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.audioBuffer;
        this.source.connect(this.gainNode);
        
        this.source.start(0);
        this.isPlaying = true;
        
        // Update UI
        document.querySelector(`.play-btn[data-track="${this.id}"]`).textContent = 'Playing...';
        
        // Reset when playback ends
        this.source.onended = () => {
            this.isPlaying = false;
            document.querySelector(`.play-btn[data-track="${this.id}"]`).textContent = 'Play';
        };
    }
    
    stop() {
        if (this.isPlaying && this.source) {
            this.source.stop();
            this.isPlaying = false;
            document.querySelector(`.play-btn[data-track="${this.id}"]`).textContent = 'Play';
        }
    }
    
    delete() {
        this.stop();
        this.audioBuffer = null;
        
        // Update UI
        document.querySelector(`.play-btn[data-track="${this.id}"]`).disabled = true;
        document.querySelector(`.delete-btn[data-track="${this.id}"]`).disabled = true;
        document.getElementById(`waveform${this.id}`).style.backgroundColor = '#eee';
    }
}

// Start the count-in and recording process
async function startRecording(trackId) {
    if (!isInitialized) {
        const success = await initializeAudio();
        if (!success) return;
    }
    
    // Already recording on another track
    if (currentlyRecordingTrack !== null) {
        alert('Already recording on another track. Please stop that recording first.');
        return;
    }
    
    // Get current BPM
    const bpm = parseInt(bpmInput.value);
    if (isNaN(bpm) || bpm < 40 || bpm > 300) {
        alert('Please enter a valid BPM between 40 and 300.');
        return;
    }
    
    currentlyRecordingTrack = trackId;
    const track = tracks[trackId - 1];
    track.isRecording = true;
    
    // Update UI
    document.querySelector(`.record-btn[data-track="${trackId}"]`).disabled = true;
    document.querySelector(`.stop-btn[data-track="${trackId}"]`).disabled = false;
    recordButtons.forEach(btn => {
        if (parseInt(btn.dataset.track) !== trackId) {
            btn.disabled = true;
        }
    });
    
    // Show count-in display
    countInDisplay.classList.remove('hidden');
    let count = 4;
    countValue.textContent = count;
    
    // Calculate beat interval in milliseconds
    const beatInterval = (60 / bpm) * 1000;
    
    // Play click sound function
    function playClick() {
        const clickOsc = audioContext.createOscillator();
        const clickGain = audioContext.createGain();
        
        clickOsc.frequency.value = 1000;
        clickGain.gain.value = 0.2;
        
        clickOsc.connect(clickGain);
        clickGain.connect(audioContext.destination);
        
        clickOsc.start();
        clickOsc.stop(audioContext.currentTime + 0.05);
    }
    
    // Start count-in
    playClick(); // Play first click immediately
    
    countInInterval = setInterval(() => {
        count--;
        countValue.textContent = count;
        
        playClick();
        
        if (count === 0) {
            clearInterval(countInInterval);
            countInDisplay.classList.add('hidden');
            
            // Start actual recording
            startMediaRecorder(trackId);
            
            // Start playback of other tracks
            tracks.forEach(t => {
                if (t.id !== trackId && t.audioBuffer) {
                    t.play();
                }
            });
        }
    }, beatInterval);
}

// Start the MediaRecorder to capture audio
async function startMediaRecorder(trackId) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Initialize the MediaRecorder
    mediaRecorder = new MediaRecorder(stream);
    recordedChunks = [];
    
    // Event handler for when data becomes available
    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };
    
    // Event handler for when recording stops
    mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        
        // Decode the audio data
        audioContext.decodeAudioData(arrayBuffer, (buffer) => {
            tracks[trackId - 1].setAudioBuffer(buffer);
        });
        
        stream.getTracks().forEach(track => track.stop());
    };
    
    // Start recording
    mediaRecorder.start();
}

// Stop the recording process
function stopRecording(trackId) {
    if (currentlyRecordingTrack !== trackId) return;
    
    // If still in count-in phase, abort it
    if (countInInterval) {
        clearInterval(countInInterval);
        countInDisplay.classList.add('hidden');
    }
    
    // Stop MediaRecorder if it's active
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
    
    // Stop all tracks that might be playing
    stopAllTracks();
    
    // Update track state
    tracks[trackId - 1].isRecording = false;
    currentlyRecordingTrack = null;
    
    // Update UI
    document.querySelector(`.record-btn[data-track="${trackId}"]`).disabled = false;
    document.querySelector(`.stop-btn[data-track="${trackId}"]`).disabled = true;
    recordButtons.forEach(btn => btn.disabled = false);
}

// Play a single track
function playTrack(trackId) {
    if (!tracks[trackId - 1]) return;
    tracks[trackId - 1].play();
}

// Delete a track
function deleteTrack(trackId) {
    if (!tracks[trackId - 1]) return;
    
    if (confirm(`Are you sure you want to delete Track ${trackId}?`)) {
        tracks[trackId - 1].delete();
    }
}

// Play all tracks simultaneously
function playAllTracks() {
    let hasAudioTracks = false;
    
    tracks.forEach(track => {
        if (track.audioBuffer) {
            track.play();
            hasAudioTracks = true;
        }
    });
    
    if (!hasAudioTracks) {
        alert('No audio tracks to play. Record some audio first!');
    }
}

// Stop all tracks
function stopAllTracks() {
    tracks.forEach(track => track.stop());
}

// Export mix as WAV file
function exportMix() {
    if (!tracks.some(track => track.audioBuffer)) {
        alert('No audio tracks to export. Record some audio first!');
        return;
    }
    
    // Find the longest track duration
    let maxDuration = 0;
    tracks.forEach(track => {
        if (track.audioBuffer) {
            maxDuration = Math.max(maxDuration, track.audioBuffer.duration);
        }
    });
    
    // Create an offline audio context for rendering
    const offlineCtx = new OfflineAudioContext(2, audioContext.sampleRate * maxDuration, audioContext.sampleRate);
    
    // Connect all tracks to the offline context
    const trackSources = [];
    tracks.forEach(track => {
        if (track.audioBuffer) {
            // Create nodes in the offline context
            const source = offlineCtx.createBufferSource();
            const gain = offlineCtx.createGain();
            const panner = offlineCtx.createStereoPanner();
            
            // Set up the source
            source.buffer = track.audioBuffer;
            
            // Copy gain and pan values
            gain.gain.value = track.gainNode.gain.value;
            panner.pan.value = track.panNode.pan.value;
            
            // Connect nodes
            source.connect(gain);
            gain.connect(panner);
            panner.connect(offlineCtx.destination);
            
            // Schedule for playback at time 0
            source.start(0);
            
            trackSources.push(source);
        }
    });
    
    // Render the offline context
    offlineCtx.startRendering().then(renderedBuffer => {
        // Convert buffer to WAV
        const wavBlob = bufferToWav(renderedBuffer);
        
        // Get project name (with fallback)
        let projectName = projectNameInput.value.trim() || 'My Recording';
        
        // Ensure filename is valid by removing special characters
        projectName = projectName.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '-');
        
        // Create a download link
        const url = URL.createObjectURL(wavBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${projectName}.wav`;
        
        // Trigger the download
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }).catch(err => {
        console.error('Error rendering audio:', err);
        alert('Error exporting mix. See console for details.');
    });
}

// Helper function: Convert AudioBuffer to WAV Blob
function bufferToWav(buffer) {
    const numOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numOfChannels * 2; // 2 bytes for 16-bit audio
    const sampleRate = buffer.sampleRate;
    
    // Create the WAV file
    const wav = new ArrayBuffer(44 + length);
    const view = new DataView(wav);
    
    // Write WAV header
    // 'RIFF' chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(view, 8, 'WAVE');
    
    // 'fmt ' sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // format (1 = PCM)
    view.setUint16(22, numOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numOfChannels * 2, true); // byte rate
    view.setUint16(32, numOfChannels * 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    
    // 'data' sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, length, true);
    
    // Write audio data
    const offset = 44;
    const channels = [];
    
    // Extract channels
    for (let i = 0; i < numOfChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }
    
    // Write interleaved audio data
    for (let i = 0; i < buffer.length; i++) {
        for (let c = 0; c < numOfChannels; c++) {
            // Convert float to 16-bit PCM
            const sample = Math.max(-1, Math.min(1, channels[c][i]));
            const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset + (i * numOfChannels + c) * 2, int16, true);
        }
    }
    
    return new Blob([wav], { type: 'audio/wav' });
}

// Helper: Write string to DataView
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}