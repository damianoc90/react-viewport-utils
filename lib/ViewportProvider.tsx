import * as React from 'react';

import {
  TViewportChangeHandler,
  IViewportChangeOptions,
  IViewport,
  IViewportCollectorUpdateOptions,
} from './types';
import ViewportCollector from './ViewportCollector';
import { VERSION } from './index';

interface IListener extends IViewportChangeOptions {
  handler: TViewportChangeHandler;
}

const ViewportContext = React.createContext({
  removeViewportChangeListener: (handler: TViewportChangeHandler) => {},
  addViewportChangeListener: (
    handler: TViewportChangeHandler,
    options: IViewportChangeOptions,
  ) => {},
  hasRootProviderAsParent: false,
  version: VERSION,
});

export const Consumer = ViewportContext.Consumer;

export default class ViewportProvider extends React.PureComponent<
  {},
  { hasListeners: boolean }
> {
  private listeners: IListener[] = [];
  private updateListenersTick: NodeJS.Timer;

  constructor(props: {}) {
    super(props);
    this.state = {
      hasListeners: false,
    };
  }

  componentWillUnmount() {
    clearTimeout(this.updateListenersTick);
  }

  triggerUpdateToListeners = (
    publicState: IViewport,
    { scrollDidUpdate, dimensionsDidUpdate }: IViewportCollectorUpdateOptions,
    options?: { isIdle: boolean },
  ) => {
    const { isIdle } = Object.assign({ isIdle: false }, options);
    const updatableListeners = this.listeners.filter(
      ({ notifyScroll, notifyDimensions, notifyOnlyWhenIdle }) => {
        if (notifyOnlyWhenIdle() && !isIdle) {
          return false;
        }
        const updateForScroll = notifyScroll() && scrollDidUpdate;
        const updateForDimensions = notifyDimensions() && dimensionsDidUpdate;
        return updateForScroll || updateForDimensions;
      },
    );
    const layouts = updatableListeners.map(
      ({ recalculateLayoutBeforeUpdate }) => {
        if (recalculateLayoutBeforeUpdate) {
          return recalculateLayoutBeforeUpdate(publicState);
        }
        return null;
      },
    );

    updatableListeners.forEach(({ handler }, index) => {
      const layout = layouts[index];
      handler(publicState, layout);
    });
  };

  addViewportChangeListener = (
    handler: TViewportChangeHandler,
    options: IViewportChangeOptions,
  ) => {
    this.listeners.push({ handler, ...options });
    this.updateListenersLazy();
  };

  removeViewportChangeListener = (h: TViewportChangeHandler) => {
    this.listeners = this.listeners.filter(({ handler }) => handler !== h);
    this.updateListenersLazy();
  };

  updateListenersLazy() {
    clearTimeout(this.updateListenersTick);
    this.updateListenersTick = setTimeout(() => {
      this.setState({
        hasListeners: this.listeners.length !== 0,
      });
    }, 0);
  }

  renderChildren = (props: { hasRootProviderAsParent: boolean }) => {
    if (!props.hasRootProviderAsParent) {
      const value = {
        addViewportChangeListener: this.addViewportChangeListener,
        removeViewportChangeListener: this.removeViewportChangeListener,
        hasRootProviderAsParent: true,
        version: VERSION,
      };
      return (
        <React.Fragment>
          {this.state.hasListeners && (
            <ViewportCollector
              onUpdate={this.triggerUpdateToListeners}
              onIdledUpdate={(state, updates) =>
                this.triggerUpdateToListeners(state, updates, { isIdle: true })
              }
            />
          )}
          <ViewportContext.Provider value={value}>
            {this.props.children}
          </ViewportContext.Provider>
        </React.Fragment>
      );
    }
    return this.props.children;
  };

  render() {
    return (
      <ViewportContext.Consumer>{this.renderChildren}</ViewportContext.Consumer>
    );
  }
}
