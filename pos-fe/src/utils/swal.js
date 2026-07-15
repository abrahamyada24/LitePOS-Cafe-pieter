import Swal from 'sweetalert2';

const themeColors = {
  confirm: '#3b82f6',
  cancel: '#9ca3af',
  danger: '#ef4444',
};

export const showAlert = {
  success: (title, text) => {
    return Swal.fire({
      icon: 'success',
      title: title,
      text: text,
      confirmButtonColor: themeColors.confirm,
      confirmButtonText: 'Oke, Siap!',
      timer: 2000,
      timerProgressBar: true
    });
  },

  error: (title, text) => {
    return Swal.fire({
      icon: 'error',
      title: title,
      text: text,
      confirmButtonColor: themeColors.confirm,
    });
  },

  warning: (title, text) => {
    return Swal.fire({
      icon: 'warning',
      title: title,
      text: text,
      confirmButtonColor: themeColors.confirm,
    });
  },

  info: (title, text) => {
    return Swal.fire({
      icon: 'info',
      title: title,
      text: text,
      confirmButtonColor: themeColors.confirm,
    });
  },

  confirm: async (title, text, confirmText = 'Ya, Lanjutkan') => {
    const result = await Swal.fire({
      title: title,
      text: text,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: themeColors.confirm,
      cancelButtonColor: themeColors.cancel,
      confirmButtonText: confirmText,
      cancelButtonText: 'Batal',
      reverseButtons: true
    });
    return result.isConfirmed;
  },

  confirmDelete: async (itemName) => {
    const result = await Swal.fire({
      title: 'Hapus Data?',
      text: `Anda yakin ingin menghapus ${itemName}? Data tidak bisa dikembalikan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: themeColors.danger,
      cancelButtonColor: themeColors.cancel,
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    });
    return result.isConfirmed;
  },

  confirmDanger: async (title, text, confirmText = 'Ya, Lanjutkan') => {
    const result = await Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: themeColors.danger,
      cancelButtonColor: themeColors.cancel,
      confirmButtonText: confirmText,
      cancelButtonText: 'Batal',
      reverseButtons: true,
      focusCancel: true,
    });
    return result.isConfirmed;
  },

  loading: (title = 'Memproses...') => {
    Swal.fire({
      title: title,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
  },

  close: () => {
    Swal.close();
  }
};
