// Foxy mascot from the Claude Design handoff (React.createElement form). Moods: idle | listen | happy | cheer | wow
fox(x){
    const E=React.createElement,C='#FF8A5C',D='#5B4038',IN='#FFD6BE',M='#FFF6EA',B='#FFB899';
    const k=[
      E('path',{key:'a',d:'M24 44 L12 6 L48 26 Z',fill:C}),E('path',{key:'b',d:'M96 44 L108 6 L72 26 Z',fill:C}),
      E('path',{key:'a2',d:'M27 36 L21 16 L38 26 Z',fill:IN}),E('path',{key:'b2',d:'M93 36 L99 16 L82 26 Z',fill:IN}),
      E('circle',{key:'h',cx:60,cy:68,r:44,fill:C}),E('ellipse',{key:'mz',cx:60,cy:84,rx:27,ry:19,fill:M}),
      E('circle',{key:'n',cx:60,cy:78,r:5.5,fill:D})
    ];
    const eye=(cx,t)=>t==='closed'?E('path',{key:'e'+cx,d:'M'+(cx-7)+' 62 Q'+cx+' 70 '+(cx+7)+' 62',stroke:D,strokeWidth:3.5,fill:'none',strokeLinecap:'round'})
      :t==='happy'?E('path',{key:'e'+cx,d:'M'+(cx-7)+' 64 Q'+cx+' 55 '+(cx+7)+' 64',stroke:D,strokeWidth:3.5,fill:'none',strokeLinecap:'round'})
      :t==='wow'?E('circle',{key:'e'+cx,cx:cx,cy:61,r:7,fill:D})
      :E('circle',{key:'e'+cx,cx:cx,cy:61,r:5,fill:D});
    if(x==='idle'){k.push(eye(44,'n'),eye(76,'n'),E('path',{key:'m',d:'M52 90 Q60 97 68 90',stroke:D,strokeWidth:3.5,fill:'none',strokeLinecap:'round'}));}
    if(x==='listen'){k.push(eye(44,'closed'),eye(76,'closed'),E('circle',{key:'m',cx:60,cy:91,r:4.5,fill:D}));}
    if(x==='happy'||x==='cheer'){k.push(eye(44,'happy'),eye(76,'happy'),E('path',{key:'m',d:'M47 88 Q60 103 73 88 Z',fill:D}),E('ellipse',{key:'tg',cx:60,cy:94,rx:6,ry:4,fill:'#FF8A8A'}),E('circle',{key:'bl1',cx:27,cy:80,r:6,fill:B}),E('circle',{key:'bl2',cx:93,cy:80,r:6,fill:B}));}
    if(x==='cheer'){k.push(E('circle',{key:'sp1',cx:12,cy:58,r:4,fill:'#FFC533'}),E('circle',{key:'sp2',cx:108,cy:52,r:5,fill:'#FFC533'}),E('circle',{key:'sp3',cx:104,cy:96,r:3.5,fill:'#2EC4B6'}));}
    if(x==='wow'){k.push(eye(44,'wow'),eye(76,'wow'),E('ellipse',{key:'m',cx:60,cy:92,rx:5.5,ry:7,fill:D}));}
    return E('svg',{viewBox:'0 0 120 116',style:{width:'100%',height:'100%',display:'block'}
