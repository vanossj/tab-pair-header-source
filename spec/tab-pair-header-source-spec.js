'use babel';

import TabPairHeaderSource from '../lib/tab-pair-header-source';

// Use the command `window:run-package-specs` (cmd-alt-ctrl-p) to run specs.
//
// To run a specific `it` or `describe` block add an `f` to the front (e.g. `fit`
// or `fdescribe`). Remove the `f` to unfocus the block.

describe('TabPairHeaderSource', () => {
  let workspaceElement, activationPromise;

  beforeEach(() => {
    workspaceElement = atom.views.getView(atom.workspace);
    activationPromise = atom.packages.activatePackage('tab-pair-header-source');
  });
  
  describe('when a header file is added to pane with mathing a source file', () => {
    
    beforeEach(() => {
      waitsForPromise(()=>{return atom.workspace.open('test.c');});
      waitsForPromise(()=>{return atom.workspace.open('test.h');});
    });
    
    xit('moves the header file item to the left of the matching source file', () => {
      //TODO: check index of pane items
    });
    
    xit('compressed source file tab', () => {
      //TODO: check size of source file tab, small
    });
    
    xit('expands the header file tab', () => {
      //TODO: check size of header file tab, large
    });
    
    it('activates header file text editor', () => {
      expect(atom.workspace.getActiveTextEditor().getPath()).toContain('test.h');
    });
  });

  describe('when a source file is added to pane with mathing a header file', () => {
    
    beforeEach(() => {
      waitsForPromise(()=>{return atom.workspace.open('test.h');});
      waitsForPromise(()=>{return atom.workspace.open('test.c');});
    });
    
    xit('moves the source file item to the right of the matching header file', () => {
      //TODO: check index of pane items
    });
    
    xit('compressed header file tab', () => {
      //TODO: check size of header file tab, small
    });
    
    xit('expands the source file tab', () => {
      //TODO: check size of source file tab, large
    });
    
    it('activates source file text editor', () => {
      expect(atom.workspace.getActiveTextEditor().getPath()).toContain('test.c');
    });
  });
  
});
