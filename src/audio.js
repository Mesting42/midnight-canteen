export class Sound {
  constructor(settings) {this.settings=settings;this.ctx=null;this.master=null;this.music=null;this.effects=null;this.timer=null;this.beat=0;this.last={};this.paused=false;}
  async unlock(){if(!this.ctx){this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.music=this.ctx.createGain();this.effects=this.ctx.createGain();this.music.connect(this.master);this.effects.connect(this.master);this.master.connect(this.ctx.destination);this.apply();}if(this.ctx.state==='suspended'&&!this.paused)await this.ctx.resume();if(!this.timer)this.timer=setInterval(()=>this.song(),420);}
  apply(){if(!this.ctx)return;this.music.gain.setTargetAtTime(this.settings.music*.16,this.ctx.currentTime,.1);this.effects.gain.setTargetAtTime(this.settings.sfx*.22,this.ctx.currentTime,.1);}
  tone(freq,duration=.15,type='sine',volume=.5,bus=this.effects,delay=0){if(!this.ctx||this.paused)return;const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(bus);o.start(t);o.stop(t+duration+.03);}
  noise(duration=.16,volume=.3){if(!this.ctx||this.paused)return;const count=Math.ceil(this.ctx.sampleRate*duration),b=this.ctx.createBuffer(1,count,this.ctx.sampleRate),data=b.getChannelData(0);for(let i=0;i<count;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/count*5);const source=this.ctx.createBufferSource(),gain=this.ctx.createGain(),filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1300;gain.gain.value=volume;source.buffer=b;source.connect(filter);filter.connect(gain);gain.connect(this.effects);source.start();}
  play(name){if(!this.ctx||this.paused)return;const now=this.ctx.currentTime;if(now-(this.last[name]??-10)<.15)return;this.last[name]=now;
    if(['notice','warning'].includes(name)){this.tone(440,.12);this.tone(330,.18,'sine',.3,undefined,.12);}
    else if(name==='bell'){this.tone(880,.5,'sine',.5);this.tone(1320,.6,'sine',.25,undefined,.06);}
    else if(['cash','buy'].includes(name)){[523,659,784].forEach((f,i)=>this.tone(f,.2,'triangle',.5,undefined,i*.08));}
    else if(['success','ending','upgrade'].includes(name)){[392,523,659,784,1046].forEach((f,i)=>this.tone(f,.5,'triangle',.4,undefined,i*.12));}
    else if(name==='ready'||name==='order'){this.tone(660,.2);this.tone(880,.25,'sine',.3,undefined,.15);}
    else if(['chop','wash','fry','boil','step'].includes(name))this.noise(name==='wash'?.6:name==='fry'?.8:.1,.25);
    else{this.tone(name==='plate'?760:520,.08,'triangle',.2);}
  }
  song(){if(!this.ctx||this.paused||this.settings.music===0)return;const notes=[392,0,493.88,587.33,0,493.88,440,0,349.23,440,523.25,0,440,0,392,0,329.63,392,493.88,0,392,0,329.63,0,293.66,349.23,440,0,349.23,0,293.66,0];const n=notes[this.beat%notes.length];if(n)this.tone(n,1.1,'sine',.4,this.music);if(this.beat%4===0)this.tone([196,174.61,164.81,146.83][Math.floor(this.beat/8)%4],1.6,'triangle',.28,this.music);this.beat++;}
  async pause(value){this.paused=value;if(this.ctx){if(value&&this.ctx.state==='running')await this.ctx.suspend();else if(!value&&this.ctx.state==='suspended')await this.ctx.resume();}}
}
