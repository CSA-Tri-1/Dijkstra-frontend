let startView;
let endView;
let pathMembersViews = [];
const pathMemberHighlightId = 'path-member';
const invalidPathHighlightId = 'invalid-path-member';
const pathMemberClassName = 'path-member';
const invalidPathClassName = 'invalid-path';
const highlightId = 'start-highlight';
const blueColor = '#4666E5';
const blackColor = '#222222';
const invalidColor = '#FF4365';
const outlineColor = '#616161';
const startAttrs = {
    padding: 2,
    attrs: {
        stroke: blueColor,
        'stroke-width': 2
    }
};
let nextId = 0;
let editMode = true; // temp true
const size = 40;
const editModePopup = document.getElementById('popup');
const getTargetMarkerStyle = () => ({ type: 'path', fill: blackColor, stroke: blackColor });
// const getLinkStyle = () => {
//     return directed ?
//         V.createSVGStyle(`
//             .joint-link .${pathMemberClassName} {
//                 stroke: ${blueColor};
//                 stroke-dasharray: 5;
//                 stroke-dashoffset: 100;
//                 animation: dash 1.25s infinite linear;
//             }
//         `) : V.createSVGStyle(`
//             .joint-link .${pathMemberClassName} {
//                 animation: stroke 0.6s ease-in-out infinite alternate;
//             }
//         `);
// }
const getStartView = () => startView;
const getEndView = () => endView;

const graph = new joint.dia.Graph;
const paperElement = document.getElementById('interactive-graph');
const paper = new joint.dia.Paper({
    el: paperElement,
    width: 800,
    height: 400,
    gridSize: 1,
    model: graph,
    sorting: joint.dia.Paper.sorting.APPROX,
    // defaultLink: () => new joint.shapes.standard.Link({ attrs: { line: { targetMarker: getTargetMarkerStyle(), stroke: outlineColor }}}),
    // defaultConnectionPoint: { name: 'boundary', args: { offset: 4 }},
    linkPinning: false,
    async: true,
    // frozen: true,
    interactive: () => editMode,
    // validateConnection: (cellViewS, _magnetS, cellViewT) => {
    //     const id = [cellViewS.model.id, cellViewT.model.id].sort().join();
    //     const existingLink = graph.getCell(id);
    //     const isSameCell = cellViewS.model.id === cellViewT.model.id;

    //     return !isSameCell && !existingLink && !cellViewT.model.isLink();
    // },
    highlighting: {
        connecting: {
            name: 'mask',
            options: {
                padding: 2,
                attrs: {
                    stroke: blueColor,
                    'stroke-width': 2
                }
            }
        }
    }
});

var namespace = joint.shapes;
var current_index = 0;

class Controller extends joint.mvc.Listener {
    get context() {
        const [ctx = null] = this.callbackArguments;
        return ctx;
    }
  }

class ViewController extends Controller {
    startListening() {
        const { paper } = this.context;

        this.listenTo(paper, {
            'element:pointerdown': selectSource,
            'element:mouseenter': selectEnd,
            'element:mouseleave': hidePathOnMouseLeave,
        });
    }
}

function selectSource({ setStartView }, elementView) {
    setStartView(elementView);
}

function selectEnd({ showPath, setEndView, getStartView, getEndView }, elementView) {
    const pathStartView = getStartView();
    const pathEndView = getEndView();

    if (elementView === pathStartView) return;
    if (pathStartView && pathEndView) {
        joint.highlighters.addClass.remove(pathStartView, invalidPathHighlightId);
        joint.highlighters.addClass.remove(pathEndView, invalidPathHighlightId);
    }
    setEndView(elementView);
    showPath();
}

function hidePathOnMouseLeave({ hidePath, getStartView, getEndView, setEndView }) {
    const pathStartView = getStartView();
    const pathEndView = getEndView();

    hidePath();
    if (pathStartView) joint.highlighters.addClass.remove(pathStartView, invalidPathHighlightId);
    if (pathEndView) joint.highlighters.addClass.remove(pathEndView, invalidPathHighlightId);
    setEndView(null);
}


class EditController extends Controller {
    startListening() {
        const { graph, paper } = this.context;

        this.listenTo(graph, {
            'change:source': replaceLink,
            'change:target': replaceLink,
        });

        this.listenTo(paper, {
            'link:mouseenter': showLinkTools,
            'link:mouseleave': hideLinkTools,
            'element:mouseenter': showElementTools,
            'element:mouseleave': hideElementTools,
            'element:pointerdblclick': removeElement,
            'blank:pointerdblclick': addElement,
        });
    }
}

function showLinkTools(_context, linkView, _evt) {
    linkView.showTools();
}

function hideLinkTools(_context, linkView) {
    linkView.hideTools();
}

function showElementTools(_context, elementView, _evt) {
    elementView.showTools();
}

function hideElementTools(_context, elementView) {
    elementView.hideTools();
}

// When a new link is created via UI (in Edit mode), remove the previous link
// and create a new one that has the ID constructed as "nodeA,nodeB". The
// reason we're removing the old link below is that it is not a good idea
// to change ID's of any model in JointJS.
function replaceLink({ createLink }, link, _collection, opt) {
    const sourceId = link.get('source').id;
    const targetId = link.get('target').id;
    if (opt.ui && sourceId && targetId) {
        link.remove();
        createLink(sourceId, targetId);
    }
    if (link.attributes.target.hasOwnProperty("id")) {
        edge_array.push([link.attributes.source, link.attributes.target]);
    }
    
}

function removeElement({ setStartView, setEndView, getStartView }, elementView) {
    const pathStart = getStartView();
    console.log()
    if (elementView.model.id === pathStart.model.id) {
        setStartView(null);
        setEndView(null);
    }
    
    elementView.model.remove();
}

function addElement({ createNode, size }, _evt, x, y) {
    const node = createNode(getNodeId(), x - size / 2, y - size / 2);
    node.position(x - size / 2, y - size / 2);
    nodes_array.push(node);
}

const viewController = new ViewController({ paper });
const editController = new EditController({ graph, paper, createLink, createNode, setStartView, setEndView, getStartView, size });

editController.startListening();

function getNodeId() {
    current_index++;
    return current_index;
}

function createNode(id) {
    var node = new joint.shapes.standard.Circle({
        id,
        size: { width: 40, height: 40 },
        attrs: {
            body: {
                fill: 'black'
            },
            label: {
                fill: 'white'
            }
        }
    }).addTo(graph);
    var view = node.findView(paper);
    view.addTools(new joint.dia.ToolsView({
        tools: [
            new joint.elementTools.HoverConnect({
                useModelGeometery: true,
                trackPath: V.convertCircleToPathData(joint.V(`<circle cx="${ 40 / 2 }" cy="${ 40 / 2 }" r="${ 40 / 2 }" />`))
            }),
        ]
    }))
    
    view.hideTools();
    node.attr('label/text', id);
    return node;
}

// creating links between nodes on map
function createLink(s, t) {
    var link = new joint.shapes.standard.Link({
        id: [s, t].sort().join(),
        source: { id: s },
        target: { id: t },
        z: 1,
        attrs: {
            wrapper: {
                stroke: 'white',
                'stroke-width': 6
            },
            line: { targetMarker: getTargetMarkerStyle(), stroke: outlineColor } 
        },
        
    });

    link.appendLabel({
        attrs: {
            text: {
                text: link.distance
            }
        }
    });

    link.addTo(graph);

    console.log(link.attributes.id, link.attributes.type)
    
    var view = link.findView(paper);
    view.addTools(new joint.dia.ToolsView({
        tools: [
            new joint.linkTools.Vertices(),
            new joint.linkTools.Remove({ distance: '10%' })
        ]
    }));
    link.distance = 10;
    link.attr('label/text', link.distance);
    console.log(link);``

    view.hideTools();
}

function setStartView(elementView) {
    hidePath();
    if (startView) {
        joint.highlighters.mask.remove(startView, highlightId);
        joint.highlighters.addClass.remove(startView, invalidPathHighlightId);
    }

    if (endView) {
        joint.highlighters.addClass.remove(endView, invalidPathHighlightId);
    }

    if (elementView) {
        joint.highlighters.mask.add(elementView, 'body', highlightId, startAttrs);
    }
    startView = elementView;
}

function setEndView(elementView) {
    endView = elementView;
}

function toggleLinkStyle() {
    if (linkStyle) paper.svg.removeChild(linkStyle);

    // linkStyle = getLinkStyle();
    paper.svg.prepend(linkStyle);
}

const styles = V.createSVGStyle(`
    .joint-element .${pathMemberClassName} {
        stroke: ${blueColor};
        fill: ${blueColor};
        fill-opacity: 0.75;
    }
    .joint-element .${invalidPathClassName} {
        stroke: ${invalidColor};
        fill: ${invalidColor};
        fill-opacity: 0.2;
    }
    @keyframes dash {
        to {
            stroke-dashoffset: 0;
        }
    }
    @keyframes stroke {
        to {
            stroke: ${blueColor};
        }
    }
`);

// let linkStyle = getLinkStyle();

paper.svg.prepend(styles);
// paper.svg.prepend(linkStyle);










