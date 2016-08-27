'use babel';

// import TabPairHeaderSourceView from './tab-pair-header-source-view';
import { CompositeDisposable } from 'atom';

export default {

  // tabPairHeaderSourceView: null,
  // modalPanel: null,
  subscriptions: null,

  activate(state) {
    // this.tabPairHeaderSourceView = new TabPairHeaderSourceView(state.tabPairHeaderSourceViewState);
    // this.modalPanel = atom.workspace.addModalPanel({
    //   item: this.tabPairHeaderSourceView.getElement(),
    //   visible: false
    // });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'tab-pair-header-source:toggle': () => this.toggle()
    }));

    this.subscriptions.add(atom.workspace.observePanes(pane => {
			this.initPane(pane);
		}));
  },

  deactivate() {
    // this.modalPanel.destroy();
    this.subscriptions.dispose();
    // this.tabPairHeaderSourceView.destroy();
  },

  // serialize() {
  //   return {
  //     tabPairHeaderSourceViewState: this.tabPairHeaderSourceView.serialize()
  //   };
  // },

  initPane(pane) {
    console.log("Pane Init")
		// this.updateTabBarVisibility(pane);
    //
		// const subscription = new CompositeDisposable();
		// subscription.add(pane.onDidDestroy(() => {
		// 	subscription.dispose()
		// 	this.subscriptions.remove(subscription)
		// }));
    //
		// subscription.add(pane.onDidAddItem(() => {
		// 	this.updateTabBarVisibility(pane);
		// }));
    //
		// subscription.add(pane.onDidRemoveItem(() => {
		// 	this.updateTabBarVisibility(pane);
		// }));
    //
		// this.subscriptions.add(subscription)
	},

  toggle() {
    console.log('TabPairHeaderSource was toggled!');

    // var
    // return (
    //   this.modalPanel.isVisible() ?
    //   this.modalPanel.hide() :
    //   this.modalPanel.show()
    // );
  }

};
