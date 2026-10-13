// TRAMVIOR — shared front-end behaviour
document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', links.classList.contains('open'));
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('open'); });
    });
  }

  var form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      
      var nama = document.getElementById('nama') ? document.getElementById('nama').value : '';
      var sekolah = document.getElementById('sekolah') ? document.getElementById('sekolah').value : '';
      var jurusan = document.getElementById('jurusan') ? document.getElementById('jurusan').value : '';
      var wa = document.getElementById('whatsapp') ? document.getElementById('whatsapp').value : '';
      var pesan = document.getElementById('pesan') ? document.getElementById('pesan').value : '';
      
      var text = "Halo Tim TRAMVIOR, saya ingin daftar Early Access.\n\n" +
                 "Nama: " + nama + "\n" +
                 "Asal Sekolah: " + sekolah + "\n" +
                 "Jurusan: " + jurusan + "\n" +
                 "Nomor WA: " + wa + "\n" +
                 "Pesan: " + pesan;
                 
      var waUrl = "https://wa.me/62895352129120?text=" + encodeURIComponent(text);
      
      var msg = document.getElementById('form-success');
      form.reset();
      if (msg) msg.style.display = 'block';
      form.style.display = 'none';
      
      window.open(waUrl, '_blank');
    });
  }
});
