var socket = io();

$(
  (function () {
    $('.deposit.item').click(function (one, two) {
      socket.emit('deposit', {
        assetid: $(this).data('assetid')
      });
    });

    $('.withdraw.item').click(function (one, two) {
      socket.emit('withdraw', {
        assetid: $(this).data('assetid'),
        price: $(this).data('price')
      });
    });
  })()
);

$(document).ready(function () {
  $('.sidenav').sidenav();
  $('.materialboxed').materialbox();
});

if (window.screen.width > 767) {
    function animateFrom(elem, direction) {
      direction = direction || 1;
      var x = 0,
        y = direction * 100;
      if (elem.classList.contains("gs_reveal_fromLeft")) {
        x = -200;
        y = 0;
      } else if (elem.classList.contains("gs_reveal_fromRight")) {
        x = 200;
        y = 0;
      }
      elem.style.transform = "translate(" + x + "px, " + y + "px)";
      elem.style.opacity = "0";
      elem.classList.add("isActive");
  
      gsap.fromTo(
        elem,
        { x: x, y: y, autoAlpha: 0 },
        {
          duration: 1.25,
          x: 0,
          y: 0,
          autoAlpha: 1,
          ease: "expo",
          overwrite: "auto",
        }
      );
    }
  
    function hide(elem) {
      gsap.set(elem, { autoAlpha: 0 });
      elem.classList.remove("isActive");
    }
  
    document.addEventListener("DOMContentLoaded", function () {
      gsap.registerPlugin(ScrollTrigger);
  
      gsap.utils.toArray(".gs_reveal").forEach(function (elem) {  
        ScrollTrigger.create({
          trigger: elem,
          onEnter: function () {
            animateFrom(elem);
          },
          onEnterBack: function () {
            animateFrom(elem, -1);
          },
          onLeave: function () {
            hide(elem);
          }, 
        });
      });
    });
  }


if (document.querySelector("#burger-button")) {
  document.querySelector("#burger-button").addEventListener("click", (e) => {
    e.target.classList.toggle("open");
    document.querySelector("body").classList.toggle("unscrool");
    document.querySelector("html").classList.toggle("unscrool");
  });
}

document.querySelector("#close-cookie")
  ? document.querySelector("#close-cookie").addEventListener("click", (e) => {
      e.target.closest(".cookie-block").classList.add("hide");
    })
  : null;

document.querySelector(".popup-layout .popup_close")
  ? document
      .querySelector(".popup-layout .popup_close")
      .addEventListener("click", (e) => {
        document.querySelector(".popup-layout").classList.add("hide");
      })
  : null;



