'use babel';

// import TabPairHeaderSourceView from './tab-pair-header-source-view';
import { CompositeDisposable } from 'atom';
const path = require('path');

//TODO: what if multiple instances of a file are open in a single pane? can that happen?

export default {
  subscriptions: null,
  sourceExtensions: null,
  headerExtensions: null,

  config: {
    headerExtensions: {
      type: "array",
      "default": ["h", "hh", "hpp", "hxx", "h++", "cuh"],
      order: 1,
      items: {
        "type": "string",
      }
    },
    sourceExtensions: {
      type: "array",
      "default": ["c", "cc", "cpp", "cp", "cxx", "c++", "cu"],
      order: 2,
      items: {
        type: "string",
      }
    },
    matchFullPath: {
      type: "boolean",
      order: 3,
      default: false
    }
    //TODO: add option for compressing to icon only, no text
  },

  activate(state) {
    this.updateConfig();

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(atom.config.onDidChange(this.updateConfig));

    // Register command that toggles this view
    // this.subscriptions.add(atom.workspace.onDidDestroyPaneItem(this.destroyedPaneItem));
    this.subscriptions.add(atom.workspace.onDidChangeActivePaneItem((ev)=>{this.changedActiveItem(ev)}));
    // this.subscriptions.add(atom.workspace.onDidAddPane(this.openedPane));
    // this.subscriptions.add(atom.workspace.onDidAddPaneItem(this.openedPaneItem));

    // this.subscriptions.add(atom.workspace.observeTextEditors((editor) => {
    //     this.subscriptions.add(editor.onDidChangePath(this.TEsetTitle));
    //     // this.subscriptions.add(editor.onDidChangeTitle(this.TEsetTitle));
    // }));

    this.subscriptions.add(atom.workspace.observePanes((pane) => {
      this.subscriptions.add(pane.onDidMoveItem((ev) => {
        setTimeout(()=>{this.movedInSamePane(pane, ev)}, 5);
      }));
      this.subscriptions.add(pane.onWillRemoveItem((ev)=>{
        this.removedPaneItem(pane, ev);
      }));
      this.subscriptions.add(pane.onDidAddItem((ev)=>{
        // wait a moment so the DOM has time to reflow
        // otherwise if we move the paneitem, it may not take
        setTimeout(()=>{this.addedPaneItem(pane, ev)}, 5);
      }));
    }));

    //TODO: add subscription for when active editor is changed,
    // need callback for editor that gains focus and editor that loses focus

    // this.subscriptions.add(atom.workspace.onDidChangeActivePaneItem(callback)((pane) => {
    //     this.subscriptions.add(pane.onDidActivate(()=>{this.changedActive();}));
    // }));  
    
    
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  // serialize() {
  //   return {
  //     tabPairHeaderSourceViewState: this.tabPairHeaderSourceView.serialize()
  //   };
  // },

  updateConfig() {
    this.useFullPath = atom.config.get('tab-pair-header-source.matchFullPath');
    this.sourceExtensions = atom.config.get('tab-pair-header-source.sourceExtensions');
    this.headerExtensions = atom.config.get('tab-pair-header-source.headerExtensions');
    for(let index=0; index < this.sourceExtensions.length; index++) {
      this.sourceExtensions[index] = "."+this.sourceExtensions[index].toLowerCase();
    }
    for(let index=0; index < this.headerExtensions.length; index++) {
      this.headerExtensions[index] = "."+this.headerExtensions[index].toLowerCase();
    }
  },

  isSource(ext) {
    var retval = false;
    if(this.sourceExtensions.indexOf(ext.toLowerCase()) >= 0) {
      retval = true;
    }
    return retval;
  },

  isHeader(ext) {
    var retval = false;
    if(this.headerExtensions.indexOf(ext.toLowerCase()) >= 0) {
      retval = true;
    }
    return retval;
  },

  isSourceHeaderPair(path1, path2) {
    var retval = false;

    if ( ( path1.name == path2.name ) &&
         ( path1.dir == path2.dir || !this.useFullPath ) &&
         ( (this.isSource(path1.ext) && this.isHeader(path2.ext)) ||
           (this.isSource(path2.ext) && this.isHeader(path1.ext)) ) ) {
          retval = true;
    }
    return retval;
  },
  
  setTabTitle(item, compress=false){
    if (compress) {
      console.log("compressing tab: " + item.getPath());
    }
    else {
      console.log("expanding tab: " + item.getPath());
    }
    var pItems = atom.workspace.getPaneItems();
    var index;
    for ( let i = 0; i < pItems.length; i++ ) {
      if (pItems[i] == item) {
        index = i;
        break;
      }
    }
    if (!index)
      return;
      
    let tab = atom.views.getView(atom.workspace).querySelectorAll('li.tab .title')[index];
    
    let filename = tab.getAttribute('data-name');

    if(tab && filename)
    {
      if (compress) {
        filename = path.extname(filename)  
        tab.parentElement.classList.add('tab-pair-header-source')
      }
      else {
        tab.parentElement.classList.remove('tab-pair-header-source')
      }
      tab.innerText = filename;
    }
  },
  
  findPaneItem(paneitem) {
    var index;
    var items;
    var pane;
    var panes = atom.workspace.getPanes();
    for(let i=0; i < panes.length; i++) {
      pane = panes[i]
      items = pane.getItems()
      for (let j=0; items.length; j++) {
        if (items[j] == paneitem) {
          index = j;
          break;
        }
      }
      if(index) {
        break;
      }
    }
    
    return {pane, index};
  },
  
  checkNeighbors(pane, index, parsedPath, compress=false) {
    if(typeof index === "undefined" || index < 0) {
      return; // bail if we couldn't find the item
    }
    
    var items = pane.getItems();
    if (items.length > index+1) {
      let editor = items[index+1];
      if (atom.workspace.isTextEditor(editor)) {
        let editor_parsedPath = path.parse(editor.getPath());
        if (this.isSourceHeaderPair(parsedPath, editor_parsedPath)) {
          this.setTabTitle(editor, compress);
        }
      }
    }
    if (index-1 >= 0) {
      let editor = items[index-1];
      if (atom.workspace.isTextEditor(editor)) {
        let editor_parsedPath = path.parse(editor.getPath());
        if (this.isSourceHeaderPair(parsedPath, editor_parsedPath)) {
          this.setTabTitle(editor, compress);
        }
      }
    }  
  },

  addedPaneItem(pane, ev) {
    console.log("addedPaneItem");

    //only worry about text editors
    if (!atom.workspace.isTextEditor(ev.item)) {
      return;
      //TODO: need to check to see, if we opened a new item in the middle of
      // and existing matched pair, if so then we should move the item, or
      // expand the tabs of the newly seperated pair
    }

    var parsedPath = path.parse(ev.item.getPath());
    if( !(this.isSource(parsedPath.ext) || this.isHeader(parsedPath.ext)) ){
      return;
    }

    console.log("  added at index: " + ev.index);

    var newIndex = -1;
    var panes = pane.getItems();
    for (let index=0; index < panes.length; index++)
    {
      //Only check text editors
      if (!atom.workspace.isTextEditor(panes[index])) {
        continue;
      }
      let editor_parsedPath = path.parse(panes[index].getPath());
      if (this.isSourceHeaderPair(parsedPath, editor_parsedPath)) {
        if (this.isSource(parsedPath.ext))
        {
          newIndex = index; //put source on left side
        }
        else { //isHeader
          newIndex = index+1; //put header on right side
        }
        if (newIndex > ev.index) {
          newIndex -= 1; // account for the affect of removing this tab
        }
        break;
      }
    }
    if (newIndex >= 0 && newIndex != ev.index) {
      console.log("Item was moved to new location: " + newIndex);
      pane.moveItem(ev.item, newIndex);
    }
    else if (newIndex == ev.index) {
      //TODO: opened the file in the correct location, need to adjust tab size
      // since moveitem event will not be triggered.
    }
    else {
      //TODO: need to check to see, if we opened a new item in the middle of
      // and existing matched pair, if so then we should move the item, or
      // expand the tabs of the newly seperated pair
      // maybe handled by changed active item? however that event is called before add event
    }
  },

  removedPaneItem(pane, ev) {
    console.log("removedPaneItem");

    //only worry about text editors
    if (!atom.workspace.isTextEditor(ev.item)) {
      return;
    }

    var parsedPath = path.parse(ev.item.getPath());
    if( !(this.isSource(parsedPath.ext) || this.isHeader(parsedPath.ext)) ){
      return;
    }

    this.checkNeighbors(pane, ev.index, parsedPath, false)
  },

  //TODO: handle tab expand/compress from this function, (addedPaneItem() is replying on this function to do the job)
  movedInSamePane(pane, ev) {
    console.log("movedInSamePane");
    //can you tell if the user requested it moved or the application moved it?

    // TODO: moved to same spot, should something be done?
    // if(ev.nexIndex == ev.oldIndex) {
    //   return;
    // }

    //only worry about text editors
    if (!atom.workspace.isTextEditor(ev.item)) {
      return;
      //TODO: need to check to see, if we moved an item in the middle of
      // and existing matched pair, than expand the tabs of the newly
      // seperated pair
    }

    var parsedPath = path.parse(ev.item.getPath());
    if( !(this.isSource(parsedPath.ext) || this.isHeader(parsedPath.ext)) ){
      return;
    }

    this.setTabTitle(ev.item, false); //TODO: does this need to be done here?

    // if we moved an item in the middle of
    // and existing matched pair, than expand the tabs of the newly
    // seperated pair
    //TODO: should we check to see if one of the tabs is compressed?
    // or does that just add unnecessary computing?
    var items = pane.getItems();
    if (items.length > ev.newIndex+1 && ev.newIndex > 0) {
      this.setTabTitle(items[ev.newIndex-1], false);
      this.setTabTitle(items[ev.newIndex+1], false);
    }
    
    // if we moved the active tab away from its pair, then we need to expand its pair
    this.checkNeighbors(pane, ev.oldIndex, parsedPath, false);
    
    // compress new pair
    this.checkNeighbors(pane, ev.newIndex, parsedPath, true);
  },
  
  changedActiveItem(paneitem) {
    console.log("changedActiveItem");
    
    if(!atom.workspace.isTextEditor(paneitem)) {
      return;
    }
    
    this.setTabTitle(paneitem, false);
    
    var result = this.findPaneItem(paneitem);
    var parsedPath = path.parse(paneitem.getPath());
    this.checkNeighbors(result.pane, result.index, parsedPath, true);
    
    //TODO: handle tab expand/compress from this function
    // in the case were the compressed tab is picked, it should be expanded
    // and the matching pair compressed, in this use case, this is the only
    // event to trigger
    
    //TODO: seems like this function could be called excessivly, maybe only
    // do this on texteditors with compressed tabs,
  },
};
