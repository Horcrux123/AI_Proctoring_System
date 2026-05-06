import React, { Suspense } from 'react';

class ChunkErrorBoundary extends React.Component {
  componentDidCatch(error) {
    if (/loading chunk/i.test(error.message) || /loading css chunk/i.test(error.message)) {
      window.location.reload();
    }
  }
  render() {
    return this.props.children;
  }
}

const Loadable = (Component) => (props) => (
  <ChunkErrorBoundary>
    <Suspense fallback={null}>
      <Component {...props} />
    </Suspense>
  </ChunkErrorBoundary>
);

export default Loadable;
