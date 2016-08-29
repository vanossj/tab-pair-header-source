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
      items: {
        "type": "string",
      }
    },
    sourceExtensions: {
      type: "array",
      "default": ["c", "cc", "cpp", "cp", "cxx", "c++", "cu"],
      items: {
        type: "string",
      }
    }
  },

  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    this.sourceExtensions = atom.config.get('tab-pair-header-source.sourceExtensions');
    this.headerExtensions = atom.config.get('tab-pair-header-source.headerExtensions');
    for(let index=0; index < this.sourceExtensions.length; index++) {
      this.sourceExtensions[index] = "."+this.sourceExtensions[index].toLowerCase();
    }
    for(let index=0; index < this.headerExtensions.length; index++) {
      this.headerExtensions[index] = "."+this.headerExtensions[index].toLowerCase();
    }

    // Register command that toggles this view
    // this.subscriptions.add(atom.workspace.onDidDestroyPaneItem(this.destroyedPaneItem));
    // // this.subscriptions.add(atom.workspace.onDidChangeActivePaneItem(this.setTitle));
    // this.subscriptions.add(atom.workspace.onDidAddPane(this.openedPane));
    // this.subscriptions.add(atom.workspace.onDidAddPaneItem(this.openedPaneItem));

    // this.subscriptions.add(atom.workspace.observeTextEditors((editor) => {
    //     this.subscriptions.add(editor.onDidChangePath(this.TEsetTitle));
    //     // this.subscriptions.add(editor.onDidChangeTitle(this.TEsetTitle));
    // }));

    this.subscriptions.add(atom.workspace.observePanes((pane) => {
        this.subscriptions.add(pane.onDidMoveItem((ev) => {
            // wait a moment so the DOM has time to reflow
            // setTimeout(this.movedInSamePane(pane, ev), 5);
            this.movedInSamePane(pane, ev);
        }));
        this.subscriptions.add(pane.onWillRemoveItem((ev)=>{
              this.removedPaneItem(pane, ev);
            }));
        this.subscriptions.add(pane.onDidAddItem((ev)=>{
              this.addedPaneItem(pane, ev);
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
    if ( path1.name == path2.name &&
         ( (this.isSource(path1.ext) && this.isHeader(path2.ext)) ||
           (this.isSource(path2.ext) && this.isHeader(path1.ext)) ) ) {
          retval = true;
    }
    return retval;
  },

  expandTabTitle(editor) {
    console.log("expandTabTitle: "+editor.getPath());
  },

  compressTabTitle(editor) {
      console.log("compressTabTitle: "+editor.getPath());
  },

  addedPaneItem(pane, ev) {
    console.log("addedPaneItem");

    //only worry about text editors
    if (!atom.workspace.isTextEditor(ev.item)) {
      return;
    }

    var parsedPath = path.parse(ev.item.getPath());
    if( !(this.isSource(parsedPath.ext) || this.isHeader(parsedPath.ext)) ){
      return;
    }

    console.log("  new index: " + ev.index);

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
        break;
      }
    }
    if (newIndex >= 0) {
      //TODO: move, does moving to exising index cause move event?
      if (newIndex == ev.index) {
        console.log("Item was moved to same location, did move event trigger?")
      }
      //TODO: should new index be calculated as though the item isn't in the array?
      // else if (index > ev.index) {
      //   index--;
      // }
      pane.moveItem(ev.item, newIndex);
    }

    //if the source/header file is in current pane,
       //if source file, place to left of exisiting header file
       //else place to right of existing source file
       //change the title of the existing source/header file to minimum size
    //else, behave normally,
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
    // expandTabTitle(ev.item); //TODO: does this need to be done here?

    if (pane.getItems().length > ev.index+1) {
      editor = pane.getItems()[ev.index+1];
      if (atom.workspace.isTextEditor(editor)) {
        let editor_parsedPath = path.parse(editor.getPath());
        if (this.isSourceHeaderPair(parsedPath, editor_parsedPath)) {
            this.expandTabTitle(editor);
        }
      }
    }
    if (pane.getItems().length > 1) {
      editor = pane.getItems()[ev.index-1];
      if (atom.workspace.isTextEditor(editor)) {
        let editor_parsedPath = path.parse(editor.getPath());
        if (this.isSourceHeaderPair(parsedPath, editor_parsedPath)) {
            this.expandTabTitle(editor);
        }
      }
    }
  },

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
    }

    var parsedPath = path.parse(ev.item.getPath());
    if( !(this.isSource(parsedPath.ext) || this.isHeader(parsedPath.ext)) ){
      return;
    }

    this.expandTabTitle(ev.item); //TODO: does this need to be done here?

    if (pane.getItems().length > ev.newIndex+1) {
      let editor = pane.getItems()[ev.newIndex+1];
      if (atom.workspace.isTextEditor(editor)) {
        let editor_parsedPath = path.parse(editor.getPath());
        if (this.isSourceHeaderPair(parsedPath, editor_parsedPath)) {
            this.compressTabTitle(editor);
        }
      }
    }
    if (pane.getItems().length > 1) {
      let editor = pane.getItems()[ev.newIndex-1];
      if (atom.workspace.isTextEditor(editor)) {
        let editor_parsedPath = path.parse(editor.getPath());
        if (this.isSourceHeaderPair(parsedPath, editor_parsedPath)) {
            this.compressTabTitle(editor);
        }
      }
    }

    //TODO: if a paneitem (not just text editor) is moved between a compressed header/source pair, then that header/source pair needs to be expanded.

    //if new position is not next to source/header, then expand both source and header
    //if new position is next to source/header, then shrink the non selected source/header, maybe after a slight delay
  },
};
