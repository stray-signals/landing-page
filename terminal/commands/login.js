import { showModal, closeModal } from '../modal.js';
import { checkCredentials }      from '../admin/auth.js';

export default {
  name:        'login',
  description: 'access admin terminal',
  handler: () => {
    showModal({
      title:  'identify yourself',
      fields: [
        { name: 'user', label: 'username', type: 'text' },
        { name: 'pass', label: 'password', type: 'password' },
      ],
      onSubmit: (values, setError) => {
        if (!checkCredentials(values.user, values.pass)) {
          setError('access denied.');
          return;
        }
        closeModal();
        document.dispatchEvent(new CustomEvent('terminal:adminlogin'));
      },
    });
    return null;
  },
};
