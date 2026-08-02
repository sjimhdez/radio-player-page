/**
 * Program and Station CPT admin: logo/image selector and station welcome-audio
 * selector (wp.media). Uses .radplapag-program-logo-wrapper so one or multiple
 * image blocks (e.g. station logo + background) work, and .radplapag-station-audio-wrapper
 * for the station's welcome audio (mp3) field.
 * Loaded on radplapag_program and radplapag_station edit screens.
 */
(function () {
  if (typeof window.jQuery === "undefined" || typeof wp === "undefined" || !wp.media) {
    return;
  }
  window.jQuery(function ($) {
    var frame;
    var currentWrapper;
    $("body").on("click", ".radplapag-program-logo-select", function (e) {
      e.preventDefault();
      currentWrapper = $(e.target).closest(".radplapag-program-logo-wrapper");
      if (!currentWrapper.length) return;
      if (frame) {
        frame.open();
        return;
      }
      frame = wp.media({ library: { type: "image" }, multiple: false });
      frame.on("select", function () {
        if (!currentWrapper || !currentWrapper.length) return;
        var att = frame.state().get("selection").first().toJSON();
        var url = (att.sizes && att.sizes.medium && att.sizes.medium.url) ? att.sizes.medium.url : att.url;
        currentWrapper.find(".radplapag-program-logo-id").val(att.id);
        currentWrapper.find(".radplapag-program-logo-preview").html(
          '<img src="' + url + '" alt="">'
        );
        currentWrapper.find(".radplapag-program-logo-remove").show();
      });
      frame.open();
    });
    $("body").on("click", ".radplapag-program-logo-remove", function (e) {
      e.preventDefault();
      var wrapper = $(e.target).closest(".radplapag-program-logo-wrapper");
      if (!wrapper.length) return;
      wrapper.find(".radplapag-program-logo-id").val("");
      wrapper.find(".radplapag-program-logo-preview").empty();
      wrapper.find(".radplapag-program-logo-remove").hide();
    });

    var audioFrame;
    var currentAudioWrapper;
    $("body").on("click", ".radplapag-station-audio-select", function (e) {
      e.preventDefault();
      currentAudioWrapper = $(e.target).closest(".radplapag-station-audio-wrapper");
      if (!currentAudioWrapper.length) return;
      if (audioFrame) {
        audioFrame.open();
        return;
      }
      audioFrame = wp.media({ library: { type: "audio" }, multiple: false });
      audioFrame.on("select", function () {
        if (!currentAudioWrapper || !currentAudioWrapper.length) return;
        var att = audioFrame.state().get("selection").first().toJSON();
        currentAudioWrapper.find(".radplapag-station-audio-id").val(att.id);
        currentAudioWrapper.find(".radplapag-station-audio-preview").html(
          '<audio controls src="' + att.url + '"></audio>'
        );
        currentAudioWrapper.find(".radplapag-station-audio-remove").show();
      });
      audioFrame.open();
    });
    $("body").on("click", ".radplapag-station-audio-remove", function (e) {
      e.preventDefault();
      var wrapper = $(e.target).closest(".radplapag-station-audio-wrapper");
      if (!wrapper.length) return;
      wrapper.find(".radplapag-station-audio-id").val("");
      wrapper.find(".radplapag-station-audio-preview").empty();
      wrapper.find(".radplapag-station-audio-remove").hide();
    });
  });
})();
