import React, { Component } from 'react';
import './App.css';

import notes from './notes.js';
const notesArray = notes['440'];
class App extends Component {
  constructor(props) {
    super(props);
    this.state = { note: '--', cents: -50 };
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    if (window.AudioContext) {
      this.audioContext = new AudioContext();
    } else {
      alert("Web Audio API not supported in this browser.");
    }

    if (navigator.getUserMedia) {
      navigator.getUserMedia({ audio: true },
        stream => this.processMicData(stream),
        e => {
          console.error(e);
          alert('Error capturing audio.');
        }
      );

    } else {
      alert('getUserMedia not supported in this browser.');
    }
  }

  processMicData = stream => {
    const source = this.audioContext.createMediaStreamSource(stream);
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 4096;
    source.connect(analyser);
    this.detectPitch(analyser);

  }

  findFundamentalFreq(buffer, sampleRate) {
    // We use Autocorrelation to find the fundamental frequency.

    // In order to correlate the signal with itself (hence the name of the algorithm), we will check two points 'k' frames away. 
    // The autocorrelation index will be the average of these products. At the same time, we normalize the values.
    // Source: http://www.phy.mty.edu/~suits/autocorrelation.html
    // Assuming the sample rate is 48000Hz, a 'k' equal to 1000 would correspond to a 48Hz signal (48000/1000 = 48), 
    // while a 'k' equal to 8 would correspond to a 6000Hz one, which is enough to cover most (if not all) 
    // the notes we have in the notes.json file.
    var n = 1024, bestR = 0, bestK = -1;
    for (var k = 8; k <= 1000; k++) {
      var sum = 0;

      for (var i = 0; i < n; i++) {
        sum += ((buffer[i] - 128) / 128) * ((buffer[i + k] - 128) / 128);
      }

      var r = sum / (n + k);

      if (r > bestR) {
        bestR = r;
        bestK = k;
      }

      if (r > 0.9) {
        // Let's assume that this is good enough and stop right here
        break;
      }
    }
    if (bestR > 0.0025) {
      // The period (in frames) of the fundamental frequency is 'bestK'. Getting the frequency from there is trivial.
      var fundamentalFreq = sampleRate / bestK;
      if (fundamentalFreq != 6000) {
        return fundamentalFreq;
      }
      else {
        return -1;
      }
    }
    else {
      // We haven't found a good correlation
      return -1;
    }
  }

  detectPitch(analyser) {
    var buffer = new Uint8Array(analyser.fftSize);
    // See initializations in the AudioContent and AnalyserNode sections of the demo.
    analyser.getByteTimeDomainData(buffer);
    var fundamentalFreq = this.findFundamentalFreq(buffer, this.audioContext.sampleRate);
    this.draw(buffer);
    if (fundamentalFreq !== -1) {
      var note = this.findClosestNote(fundamentalFreq, notesArray); // See the 'Finding the right note' section.
      var cents = this.findCentsOffPitch(fundamentalFreq, note.frequency); // See the 'Calculating the cents off pitch' section.
      this.setState({ note: note.note, cents: cents });
    }

    requestAnimationFrame(() => this.detectPitch(analyser));
  };

  draw(buffer) {
    const canvas = this.canvas;
    const context = canvas.getContext('2d');
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#f80';
    buffer.forEach((item, i) => {
      // Draw
      const x = (i / buffer.length) * canvas.width;
      const y = item / 255 * canvas.height;
      context.fillRect(x, y, 1, 1);

    });
  }

  findClosestNote(freq, notes) {
    // Use binary search to find the closest note
    var low = -1, high = notes.length;
    while (high - low > 1) {
      var pivot = Math.round((low + high) / 2);
      if (notes[pivot].frequency <= freq) {
        low = pivot;
      } else {
        high = pivot;
      }
    }
    if (Math.abs(notes[high].frequency - freq) <= Math.abs(notes[low].frequency - freq)) {
      // notes[high] is closer to the frequency we found
      return notes[high];
    }

    return notes[low];
  }

  findCentsOffPitch(freq, refFreq) {
    // We need to find how far freq is from baseFreq in cents
    var log2 = 0.6931471805599453; // Math.log(2)
    var multiplicativeFactor = freq / refFreq;

    // We use Math.floor to get the integer part and ignore decimals
    var cents = Math.floor(1200 * (Math.log(multiplicativeFactor) / log2));
    return cents;
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">Guitar Tuner</h1>
        </header>
        <p className="App-intro">
          Note: {this.state.note} Cents: {this.state.cents}
        </p>
        <canvas id="canvas" className="Canvas" ref={c => this.canvas = c} />
      </div>
    );
  }
}

export default App;
