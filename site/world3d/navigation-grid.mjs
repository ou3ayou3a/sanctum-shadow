class MinHeap {
  constructor(){this.items=[];}
  get size(){return this.items.length;}
  push(value){const items=this.items;items.push(value);let index=items.length-1;while(index>0){const parent=(index-1)>>1;if(items[parent].f<=value.f)break;items[index]=items[parent];index=parent;}items[index]=value;}
  pop(){const items=this.items,first=items[0],last=items.pop();if(items.length&&last){let index=0;while(true){const left=index*2+1,right=left+1;if(left>=items.length)break;let child=left;if(right<items.length&&items[right].f<items[left].f)child=right;if(items[child].f>=last.f)break;items[index]=items[child];index=child;}items[index]=last;}return first;}
}

const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;

export class NavigationGrid {
  constructor({ minX, maxX, minZ, maxZ, cellSize = .75, obstacles = [], padding = .55 }) {
    this.minX=finite(minX);this.maxX=finite(maxX);this.minZ=finite(minZ);this.maxZ=finite(maxZ);
    this.cellSize=Math.max(.25,finite(cellSize,.75));this.padding=Math.max(0,finite(padding,.55));this.obstacles=obstacles;
    this.columns=Math.floor((this.maxX-this.minX)/this.cellSize)+1;
    this.rows=Math.floor((this.maxZ-this.minZ)/this.cellSize)+1;
    this.blocked=new Uint8Array(this.columns*this.rows);this.rebuild(obstacles);
  }

  index(cell){return cell.z*this.columns+cell.x;}
  cellAt(point){return{x:Math.max(0,Math.min(this.columns-1,Math.round((finite(point?.x)-this.minX)/this.cellSize))),z:Math.max(0,Math.min(this.rows-1,Math.round((finite(point?.z)-this.minZ)/this.cellSize)))};}
  pointAt(cell){return{x:this.minX+cell.x*this.cellSize,y:0,z:this.minZ+cell.z*this.cellSize};}
  inBounds(cell){return cell.x>=0&&cell.z>=0&&cell.x<this.columns&&cell.z<this.rows;}
  isBlocked(cell){return !this.inBounds(cell)||this.blocked[this.index(cell)]===1;}
  isPointBlocked(point){const x=finite(point?.x),z=finite(point?.z);if(x<this.minX||x>this.maxX||z<this.minZ||z>this.maxZ)return true;return this.obstacles.some(o=>Math.abs(x-finite(o.x))<=Math.max(0,finite(o.hw))+this.padding&&Math.abs(z-finite(o.z))<=Math.max(0,finite(o.hd))+this.padding);}

  rebuild(obstacles=this.obstacles){this.obstacles=Array.isArray(obstacles)?obstacles.filter(Boolean):[];this.blocked.fill(0);for(const obstacle of this.obstacles){const hw=Math.max(0,finite(obstacle.hw))+this.padding,hd=Math.max(0,finite(obstacle.hd))+this.padding,min=this.cellAt({x:finite(obstacle.x)-hw,z:finite(obstacle.z)-hd}),max=this.cellAt({x:finite(obstacle.x)+hw,z:finite(obstacle.z)+hd});for(let z=min.z;z<=max.z;z++)for(let x=min.x;x<=max.x;x++){const point=this.pointAt({x,z});if(Math.abs(point.x-finite(obstacle.x))<=hw&&Math.abs(point.z-finite(obstacle.z))<=hd)this.blocked[this.index({x,z})]=1;}}return this;}

  nearestOpen(cell,maxRadius=Math.max(this.columns,this.rows)){
    if(!this.isBlocked(cell))return cell;
    for(let radius=1;radius<=maxRadius;radius++)for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
      if(Math.abs(dx)!==radius&&Math.abs(dz)!==radius)continue;
      const candidate={x:cell.x+dx,z:cell.z+dz};if(this.inBounds(candidate)&&!this.isBlocked(candidate))return candidate;
    }
    return null;
  }

  projectOpen(point){const cell=this.nearestOpen(this.cellAt(point));return cell?this.pointAt(cell):null;}

  hasLineOfSight(a,b){
    const dx=b.x-a.x,dz=b.z-a.z,distance=Math.hypot(dx,dz),steps=Math.max(1,Math.ceil(distance/(this.cellSize*.32)));
    for(let index=0;index<=steps;index++){const t=index/steps;if(this.isPointBlocked({x:a.x+dx*t,z:a.z+dz*t}))return false;}
    return true;
  }

  findPath(startPoint,endPoint){
    const start=this.nearestOpen(this.cellAt(startPoint)),requestedGoal=this.cellAt(endPoint),goal=this.nearestOpen(requestedGoal);if(!start||!goal)return[];
    const adjustedGoal=goal.x!==requestedGoal.x||goal.z!==requestedGoal.z||this.isPointBlocked(endPoint),key=cell=>cell.z*this.columns+cell.x,heuristic=cell=>Math.hypot(goal.x-cell.x,goal.z-cell.z),open=new MinHeap(),cameFrom=new Int32Array(this.columns*this.rows).fill(-1),best=new Float64Array(this.columns*this.rows).fill(Infinity),closed=new Uint8Array(this.columns*this.rows),startKey=key(start),goalKey=key(goal),directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    best[startKey]=0;open.push({...start,g:0,f:heuristic(start)});
    while(open.size){
      const current=open.pop(),currentKey=key(current);if(closed[currentKey])continue;
      if(currentKey===goalKey){const cells=[];let cursor=goalKey;while(cursor>=0){cells.push({x:cursor%this.columns,z:Math.floor(cursor/this.columns)});if(cursor===startKey)break;cursor=cameFrom[cursor];}if(cells.at(-1)?.x!==start.x||cells.at(-1)?.z!==start.z)return[];cells.reverse();const points=cells.map(cell=>this.pointAt(cell));if(!adjustedGoal&&this.hasLineOfSight(points.at(-1),endPoint))points[points.length-1]={x:endPoint.x,y:0,z:endPoint.z};return this.simplify(points);}
      closed[currentKey]=1;
      for(const[dx,dz]of directions){const next={x:current.x+dx,z:current.z+dz};if(this.isBlocked(next))continue;if(dx&&dz&&(this.isBlocked({x:current.x+dx,z:current.z})||this.isBlocked({x:current.x,z:current.z+dz})))continue;const nextKey=key(next),score=current.g+(dx&&dz?Math.SQRT2:1);if(score>=best[nextKey])continue;best[nextKey]=score;cameFrom[nextKey]=currentKey;open.push({...next,g:score,f:score+heuristic(next)});}
    }
    return[];
  }

  simplify(points){
    if(points.length<3)return points;const result=[points[0]];let anchor=0;
    while(anchor<points.length-1){let next=points.length-1;while(next>anchor+1&&!this.hasLineOfSight(points[anchor],points[next]))next--;result.push(points[next]);anchor=next;}
    return result;
  }
}
