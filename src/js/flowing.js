var canvas ;


var MVVM = new Vue({
  el: 'body',
  data: {
    islink: false, //是否在连线操作
    links: [],
    steps: [
      {
        typcd: 'start',
        name: 'order',
        sdesc: '下单',
        next_node: 'confirm'
      },
      {
        typcd: 'start',
        name: 'order',
        sdesc: '下单',
        next_node: 'cancel'
      },
      {
        name: 'confirm',
        sdesc: '确认',
        next_node: 'send'
      },
      {
        name: 'cancel',
        sdesc: '取消订单'
      },
      {
        name: 'send',
        sdesc: '发货'
      }
    ],
    linelinks: [],  // 流程块和直线间的关系
    selectedObj: undefined,
    arrows: [], // 直线和箭头的关系
    flowText: '',// 选中的流程快的文本 
    canvasZoom: 100
  },
  methods: {
    switchLine: function(){
      this.islink = !this.islink
      this.links = []
    },

    addRect: function(){
      drawRect('发货', 100, 100)
    },

    submit:  function(){
      store.set('flowing', {
        canvas: JSON.stringify(canvas),
        linelinks: MVVM.linelinks,
        arrows: MVVM.arrows
      })
    },

    empty: function(){
      if(!confirm('确定清空场景？')) { return false }
      store.clear()
      canvas.clear()
      MVVM.linelinks = []
      MVVM.arrows = []
    },

    setText: function(){
      this.selectedObj.set({text: this.flowText})
      refreshCanvas()
    },

    getData: function(){
      return _.reduce(MVVM.linelinks, function(result, line){
        var fromObj = findObj(line[1])
        var toObj = findObj(line[2])

        result.push({
          oid: fromObj.id,
          name: fromObj.key,
          desc: fromObj.item(1).text,
          next: toObj.key
        })

        var repeat = _.find(result, function(item){
          return item.oid == toObj.oid && item.next == toObj.next 
        })
        if(!repeat){
          result.push({
            oid: toObj.id,
            name: toObj.key,
            desc: toObj.item(1).text
          })
        }

        return result
      }, [])
    }
  }
})


MVVM.$watch('canvasZoom', function(val){
  var inner = $('#c').closest('.flowings').find('.inner')
  canvas.zoomToPoint(new fabric.Point(canvas.getCenter().left, inner.height() / 2), val / 100)
})

$(function(){

  var area = $('#c').closest('.flowings').find('.area')
  $('#c').attr('width', area.width()).attr('height', area.height())
  canvas = new fabric.Canvas('c')
  
  canvas.setBackgroundColor({
    source: 'src/css/bg.gif',
    repeat: 'repeat',
  }, canvas.renderAll.bind(canvas));
  

  // 初始化
  initSteps()
  
  // 画线
  canvas.on('mouse:down', function(options) {
    
    MVVM.selectedObj = undefined
    if (options.target && options.target.type == 'group') {
      var text = options.target.item(1)
      if (text.type == 'text') {
        MVVM.flowText = text.text
        MVVM.selectedObj = text
      }
    }

    if(!options.target) { return }

    if (options.target.type != 'line') {
       if(!MVVM.islink){return}
       var tar = options.target
       MVVM.links.push(tar)
       
       if(MVVM.links.length == 2){
          linkLine(MVVM.links[0], MVVM.links[1])

          MVVM.islink = false
          MVVM.links = []
       }
    }
    
  })


  // 移动方块 重新计算连线
  canvas.on('object:moving', function(options) {
    reLinkLine(options.target)
  })

  

  // 删除对象
  $('body').keydown(function(e){
    console.log(e.keyCode)
    if(e.keyCode == 46) {
      removeObj(canvas.getActiveObject())
    }
  })
}) 



/**
 * 初始化流程数据
 */
function initSteps(){
  if(!store.get('flowing')){ return }
  canvas.loadFromJSON(store.get('flowing').canvas)

  refreshCanvas()

  // 创建关联
  MVVM.linelinks = store.get('flowing').linelinks
  MVVM.arrows = store.get('flowing').arrows



  //重置每个对象的 toObject 方法，需要在每次初始化后执行
  canvas.getObjects().forEach(function(item){
    resetToObject(item)
  })

}

/**
 *  解决不能直接显示 需要点一次才能显示的bug
 */
function refreshCanvas(){
  canvas.remove(drawRect('', -1000, -1000))
}

/**
 * 连线
 */
function linkLine(rect1, rect2){
  var line = drawLine(
    rect1.left + rect1.width/2,
    rect1.height + rect1.top,
    rect2.left + rect2.width/2,
    rect2.top
  )
  MVVM.linelinks.push([line.id, rect1.id, rect2.id]) 
}

/**
 * 创建直线
 */
function drawLine(x1, y1, x2, y2){
  var line = new fabric.Line([x1, y1, x2, y2 - 10],{
    stroke: 'blue',
    hasControls: false
  })

  line.id = generateID()
  var arrow = drawArrow(x2 - 5, y2 - 10)
  MVVM.arrows.push([line.id, arrow.id])
  resetToObject(line)
  
  canvas.add(line);

  return line
}

/**
 * 创建箭头
 */
function drawArrow(left, top){
  var path = new fabric.Path('M 0 0 L 10 0 L 5 10 z');
  path.set({left: left, top: top, fill: 'blue'})
  path.id = generateID()
  resetToObject(path)

  canvas.add(path);
  return path
}

/**
 * 根据直线定位其箭头的位置
 */
function locationArrowByLine(line){
  var arrow = findObj(_.find(MVVM.arrows, function(item){
    return item[0] == line.id
  })[1])
  
 arrow.set({left: line.x2 - 5, top: line.y2 - 10})
}

/**
 * 重新计算某个块的连线位置
 */
function reLinkLine(rect){

  _.each(MVVM.linelinks, function(item){
    if (item[1] == rect.id || item[2] == rect.id) {
      var line = findObj(item[0])
      var rect1
      var rect2

      if (item[1] == rect.id) {
        rect1 = rect
        rect2 = findObj(item[2])
      }else{
        rect1 = findObj(item[1])
        rect2 = rect
      }
      if (rect1) {
        line.set({
          x1: rect1.left + rect1.width/2,
          y1: rect1.height + rect1.top
        })
      }
      if (rect2) {
        line.set({
          x2: rect2.left + rect2.width/2,
          y2: rect2.top,
        })

        locationArrowByLine(line)
      }
    }

  })

}


/**
 * 创建流程块
 */
function drawRect(txt, left, top){
  var rect = new fabric.Rect({
    originX: 'center',
    originY: 'center',
    fill: '#FFF',
    width: 150,
    height: 50,
    strokeWidth: 5,
    stroke: '#8a6d3b'
  });

  var text = new fabric.Text(txt, {
    fontSize: 20,
    originX: 'center',
    originY: 'center'
  });

  
  var group = new fabric.Group([ rect, text ], {
    left: left,
    top: top
  });

  group.id = generateID()

  resetToObject(group)

  canvas.add(group);

  
  return group
}



/**
 *重写某个对象的 toObject 方法，以保存我们的某些自定义字段，如ID
 */
function resetToObject(obj){
  switch(obj.type){
    case 'group':
      obj.toObject = (function(toObject) {
        return function() {
          return fabric.util.object.extend(toObject.call(this), {
            id: this.id
          });
        };
      })(obj.toObject);

    case 'line':
      obj.toObject = (function(toObject) {
        return function() {
          return fabric.util.object.extend(toObject.call(this), {
            id: this.id,
            selectable: this.selectable
          });
        };
      })(obj.toObject);

    case 'path':
      obj.toObject = (function(toObject) {
        return function() {
          return fabric.util.object.extend(toObject.call(this), {
            id: this.id
          });
        };
      })(obj.toObject);
  }
}



/**
 * 生成某个对象的唯一ID
 */
function generateID(){
  return Date.parse(new Date()) + '' + parseInt(Math.random() * 1000)
}

/**
 * 通过ID查找canvas里面的某个元素
 */
function findObj(id){
  return _.find(canvas.getObjects(), function(obj){
    return obj.id == id
  })
}


/**
 * 删除对象
 */
function removeObj(obj){
  canvas.remove(obj)
}
