export const vertexShader = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;
export const fragmentShader = `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float mode;
uniform float seed;
uniform float reveal;
uniform float prismTime;
uniform float prismLight;
uniform float prismScale;
uniform vec3 accent;
uniform vec3 pigment;
uniform vec3 shadow;
uniform vec4 score;
uniform vec3 direction;
uniform vec3 song;
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
}
float fbm(vec2 p) {
  float v=0., a=.5;
  for(int i=0;i<4;i++) { v+=a*noise(p); p=mat2(1.6,1.2,-1.2,1.6)*p+7.1; a*=.5; }
  return v;
}
mat2 turn(float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }
void main() {
  vec2 uv=gl_FragCoord.xy/resolution;
  vec2 p=(gl_FragCoord.xy-.5*resolution)/min(resolution.x,resolution.y);
  float t=mode>3.5 && mode<4.5 ? prismTime : time;
  float swell=score.x+score.y*.6;
  float expansion=score.z*.09+score.w*.16;
  p=turn(score.z*.065*sin(direction.z*6.28))*p/(1.+expansion+swell*.26);
  p += direction.xy*score.z*.22;
  p += swell*.09*vec2(sin(p.y*4.+direction.z*6.28),cos(p.x*3.));
  p += .08*vec2(sin(t*.12+seed),cos(t*.09+seed));
  vec3 base=mix(shadow*.09,pigment*.15,.6);
  vec3 cool=mix(accent,mix(pigment,accent,.7),.1);
  vec3 warm=mix(accent,pigment,.45);
  vec3 color=base;
  vec2 q=p;
  if(mode<.5) {
    q=turn(.35*sin(t*.07))*p;
    vec2 warp=vec2(fbm(q*2.+t*.08+seed),fbm(q*2.-t*.06+12.));
    float cloud=fbm(q*3.+warp*3.+vec2(t*.04,-t*.06));
    color+=warm*pow(cloud,2.5)*1.8;
    float curtain=exp(-abs(q.y+.3*sin(q.x*1.8+cloud*3.+t*.12))*9.);
    float threads=pow(fbm(vec2(q.x*12.,q.y*.7)+t*.04),2.);
    color+=mix(accent,cool,.4)*curtain*threads*1.4;
    for(int i=0;i<5;i++) {
      float fi=float(i);
      float ribbon=q.y+.22*sin(q.x*2.+t*.15+fi*.6)+.35*(cloud-.5)+(fi-2.)*.13;
      float light=exp(-abs(ribbon)*35.);
      color+=mix(cool,warm,fi*.2)*light*(.3+.18*sin(q.x+t*.2+fi));
    }
  } else if(mode<1.5) {
    float flow=fbm(p*2.5+vec2(t*.06,seed));
    float height=fbm(p*4.+flow*2.-t*.04);
    float contour=pow(.5+.5*cos(height*65.+t*.3),14.);
    color+=mix(pigment,cool,height)*(.15+height*.8);
    color+=accent*contour*.5;
    float foam=pow(.5+.5*sin(p.x*3.+p.y*2.+flow*8.-t*.25),20.);
    color+=cool*foam*.35;
    float tide=pow(.5+.5*cos(height*23.-t*.16),20.);
    float glints=pow(noise(p*65.+flow*3.),14.);
    color+=mix(accent,pigment,.2)*(tide*.35+glints*.6);
  } else if(mode<2.5) {
    q=turn(-.4+.08*sin(t*.07))*p;
    q.y*=1.55;
    float r=length(q), a=atan(q.y,q.x);
    vec2 warp=vec2(fbm(p*2.+vec2(t*.04,seed)),fbm(p*2.-t*.03+4.));
    float cloud=fbm(p*3.+warp*3.);
    float spiral=sin(a*3.+log(r+.08)*5.-t*.17+cloud*3.);
    float arms=pow(.5+.5*spiral,3.)*exp(-r*1.8);
    color+=warm*cloud*cloud*1.1+cool*arms*1.4;
    float filaments=pow(.5+.5*sin(spiral*4.+cloud*18.),6.)*arms;
    color+=cool*filaments*1.2;
    float disk=exp(-abs(r-.29-cloud*.045)*65.);
    float halo=exp(-abs(r-.31)*13.);
    color+=mix(accent,vec3(1.,.84,.66),.25)*disk*(1.4+.7*sin(a+t*.2));
    color+=warm*halo*.6;
    color+=accent*disk*pow(.5+.5*sin(a*2.-t*.35),10.)*.8;
    color+=cool*exp(-abs(r-.48-cloud*.08)*85.)*.12;
    float eclipse=smoothstep(.25,.295,r);
    color=mix(base*.35,color,eclipse);
    color+=accent*.35*exp(-abs(r-.265)*160.);
    color+=cool*exp(-abs(q.y)*90.)*exp(-r*2.)*.18;
  }
  else if(mode<3.5) {
    q=p-vec2(.08,-.05);
    float r=length(q), edge=.245;
    vec2 radial=q/max(r,.001);
    float plasma=fbm(radial*4.5+vec2(t*.12,seed));
    float corona=exp(-max(0.,r-edge)*(10.+plasma*6.))*smoothstep(.20,.25,r);
    float threads=pow(.5+.5*sin(plasma*25.+r*20.-t*.45),7.);
    vec3 solar=mix(warm,vec3(1.,.35,.06),.3);
    color+=solar*corona*(.6+threads*1.5);
    color+=accent*exp(-abs(r-edge)*160.)*1.2;
    float surface=fbm(q*18.+vec2(t*.08,-t*.05));
    vec3 star=mix(solar*.3,accent,surface)*(.3+.8*surface);
    star+=solar*pow(.5+.5*sin(surface*24.+t*.2),8.)*.35;
    color=mix(color,star,1.-smoothstep(edge-.005,edge+.005,r));
    color+=warm*exp(-r*2.)*.12;
  } else if(mode<4.5) {
    q=turn(-.4+.08*sin(t*.08))*p*prismScale;
    vec2 cell=floor(q), local=fract(q);
    float first=10., second=10., facet=0.;
    vec2 closest=vec2(0.);
    for(int y=-1;y<=1;y++) {
      for(int x=-1;x<=1;x++) {
        vec2 offset=vec2(float(x),float(y));
        vec2 id=cell+offset;
        float h=hash(id+seed);
        vec2 point=offset+.5+.25*sin(vec2(h*37.,h*71.)+t*.13)-local;
        float d=dot(point,point);
        if(d<first) { second=first; first=d; facet=h; closest=point; }
        else { second=min(second,d); }
      }
    }
    vec3 spectrum=.55+.45*cos(vec3(0.,2.1,4.2)+facet*6.+q.x*.35+t*.06);
    vec3 glass=mix(mix(pigment,accent,facet),spectrum,.22);
    float face=.12+.35*max(0.,dot(normalize(closest+vec2(.001)),vec2(-.6,.8)));
    float seam=exp(-(second-first)*38.);
    color+=glass*(face+exp(-first*3.)*.2)+accent*seam*.45;
    for(int i=0;i<3;i++) {
      float fi=float(i);
      float beam=q.x*.7+q.y*.45+sin(t*.1+fi)*1.8+fi*.8;
      color+=mix(cool,spectrum,fi*.25)*exp(-abs(beam)*9.)*.35;
    }
  } else if(mode<5.5) {
    q=turn(.3+sin(t*.03)*.12)*p;
    vec2 warp=vec2(fbm(q*2.+seed+t*.025),fbm(q*3.-t*.02));
    float cloud=fbm(q*3.+warp*3.);
    float lane=exp(-abs(q.y+.22*sin(q.x*2.+t*.04)) * 3.);
    color+=mix(warm,cool,cloud)*cloud*cloud*lane*2.2;
    for(int i=0;i<40;i++) {
      float fi=float(i);
      float h=hash(vec2(fi,seed));
      float z=fract(h+t*(.025+.015*h));
      vec2 origin=vec2(hash(vec2(fi,3.1)),hash(vec2(fi,9.7)))*2.-1.;
      vec2 position=origin*.72/(1.1-z);
      vec2 delta=p-position;
      vec2 direction=normalize(position+vec2(.001));
      float size=.0025+.008*z*z;
      float streak=dot(delta,direction)/(size*(1.+z*z*z*10.));
      float crosswise=dot(delta,vec2(-direction.y,direction.x))/size;
      float light=exp(-streak*streak-crosswise*crosswise);
      float fade=smoothstep(0.,.08,z)*(1.-smoothstep(.85,1.,z));
      color+=mix(accent,vec3(.85,.95,1.),h)*light*fade*(.7+z);
    }
  }
  else if(mode<6.5) {
    q=p*1.4;
    vec2 current=vec2(fbm(q*2.+vec2(t*.035,seed)),fbm(q*2.+vec2(seed,-t*.04)));
    float ink=fbm(q*2.2+current*3.8);
    float folds=sin(ink*19.+q.y*2.);
    float pigmentPool=smoothstep(.22,.78,ink);
    color=mix(shadow*.4,mix(pigment,accent,smoothstep(.1,.85,ink)),pigmentPool*.9);
    color+=accent*exp(-abs(folds)*12.)*.22*ink;
    color*=.55+.45*fbm(q+current);
  } else if(mode<7.5) {
    q=turn(-.3)*p;
    float aperture=.2*sin(t*.065+seed);
    float plane=smoothstep(-.3,.45,q.x+q.y*.3);
    color=mix(shadow*.35,pigment*.35,plane);
    float beam=exp(-abs(q.x-aperture+q.y*.3)*5.);
    float beam2=exp(-abs(q.x+.5-aperture+q.y*.3)*15.);
    float slats=.3+.7*smoothstep(.12,.2,fract((q.y+q.x*.2)*3.+t*.008));
    color+=mix(pigment,accent,.65)*(beam*.65+beam2*.3)*slats;
    color*=.45+.55*smoothstep(-.38,-.34,q.y-q.x*.35);
    color+=accent*.06*exp(-abs(q.y-q.x*.35+.35)*70.);
  } else {
    color=mix(shadow*.5,accent*.2,smoothstep(-.45,.6,p.y));
    for(int i=0;i<5;i++) {
      float layer=float(i),depth=layer/4.;
      float hill=-.1-depth*.15+.12*sin(p.x*(1.2+layer*.32)+seed+layer*2.3+t*.012);
      hill+=.065*noise(vec2(p.x*(2.+layer*.5)+t*.012,layer*7.+seed));
      float land=1.-smoothstep(hill-.012,hill+.012,p.y);
      vec3 ground=mix(mix(accent,pigment,.65),shadow,depth*.85);
      ground*=.75-depth*.35;
      color=mix(color,ground,land);
      color+=mix(accent,pigment,depth)*exp(-abs(p.y-hill)*20.)*.055;
    }
    float haze=exp(-abs(p.y+.1)*4.);
    color+=accent*haze*.08;
  }
  if(mode<5.5) {
  for(int i=0;i<2;i++) {
    float layer=float(i);
    vec2 starUV=p*(22.+layer*19.)+vec2(t*.035*(layer+1.),t*.018)+seed*13.;
    vec2 id=floor(starUV), f=fract(starUV)-.5;
    float h=hash(id+layer*17.);
    float star=exp(-length(f)*100.)*step(.94,h);
    float twinkle=.65+.35*sin(t*(.4+h)+h*90.);
    color+=mix(accent,vec3(.9,.96,1.),.6)*star*twinkle*(1.+layer);
  }
  }
  vec2 focal=p-direction.xy;
  float radius=length(focal);
  float halo=exp(-radius*radius*2.4);
  float flow=sin(focal.x*3.5+focal.y*2.+direction.z*6.28+time*.12);
  float filaments=pow(.5+.5*sin(radius*18.-score.x*4.+flow*2.),6.);
  color+=mix(pigment,accent,.65)*halo*(swell*.85+score.z*.24);
  color+=mix(accent,pigment,direction.z)*filaments*exp(-radius*2.)*swell*.48*step(mode,5.5);
  float ribbon=exp(-abs(focal.y+.28*sin(focal.x*3.+direction.z*6.28+time*.09))*13.);
  color+=mix(accent,pigment,.4)*ribbon*score.z*.7;
  color+=mix(shadow,pigment,.55)*score.w*(.12+.32*halo);
  float sweep=exp(-pow((uv.x+uv.y*.32-song.x*1.85+.25)*3.2,2.));
  color+=mix(pigment,accent,uv.y)*sweep*song.y*.8;
  color+=shadow*song.y*.16;
  float vignette=1.-.45*dot(uv-.5,uv-.5);
  color=vec3(1.)-exp(-max(color,vec3(0.))*1.35);
  float light=mode>3.5 && mode<4.5 ? prismLight : 1.;
  gl_FragColor=vec4(color*vignette*(.32+.68*reveal)*light,1.);
}
`;
