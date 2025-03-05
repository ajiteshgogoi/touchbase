import { useRegisterSW } from 'virtual:pwa-register/react';

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setNeedRefresh(false);
  };

  const update = () => {
    updateServiceWorker(true);
  };

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="fixed bottom-0 right-0 m-4 p-4 bg-white shadow-lg rounded-lg border border-primary-100">
      <div className="flex items-center">
        <p className="text-sm text-gray-600 mr-4">
          A new version is available
        </p>
        <button
          className="bg-primary-500 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-600 transition-colors mr-2"
          onClick={update}
        >
          Reload
        </button>
        <button
          className="text-gray-500 hover:text-gray-700 transition-colors"
          onClick={close}
        >
          ✕
        </button>
      </div>
    </div>
  );
}