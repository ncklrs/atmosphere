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
uniform vec3 accent;
uniform vec3 pigment;
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
  float t=time;
  p += .08*vec2(sin(t*.12+seed),cos(t*.09+seed));
  vec3 base=mix(vec3(.025,.016,.065),pigment*.14,.65);
  vec3 cool=mix(accent,vec3(.15,.48,.8),.3);
  vec3 warm=mix(accent,pigment,.45);
  vec3 color=base;
  vec2 q=p;
  if(mode<.5) {
    q=turn(.35*sin(t*.07))*p;
    vec2 warp=vec2(fbm(q*2.+t*.08+seed),fbm(q*2.-t*.06+12.));
    float cloud=fbm(q*3.+warp*3.+vec2(t*.04,-t*.06));
    color+=warm*pow(cloud,2.5)*1.8;
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
    color+=cool*foam*.25;
  } else {
    q=turn(-.4)*p;
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
    float eclipse=smoothstep(.25,.295,r);
    color=mix(base*.35,color,eclipse);
    color+=accent*.35*exp(-abs(r-.265)*160.);
    color+=cool*exp(-abs(q.y)*90.)*exp(-r*2.)*.18;
  }
  // Two independently drifting star layers give depth without moving DOM nodes.
  for(int i=0;i<2;i++) {
    float layer=float(i);
    vec2 starUV=p*(22.+layer*19.)+vec2(t*.035*(layer+1.),t*.018)+seed*13.;
    vec2 id=floor(starUV), f=fract(starUV)-.5;
    float h=hash(id+layer*17.);
    float star=exp(-length(f)*100.)*step(.94,h);
    float twinkle=.65+.35*sin(t*(.4+h)+h*90.);
    color+=mix(accent,vec3(.9,.96,1.),.6)*star*twinkle*(1.+layer);
  }
  float vignette=1.-.45*dot(uv-.5,uv-.5);
  color=vec3(1.)-exp(-max(color,vec3(0.))*1.35);
  gl_FragColor=vec4(color*vignette,1.);
}
`;
