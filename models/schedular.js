module.exports = function(mongoose) {
    "use strict";
    var Schema = mongoose.Schema;

    var schedularSchema = new Schema({
        userid: String,
        playlist_id: {
            type: Schema.ObjectId,
            ref: 'Playlist'
        },
        locations: Array,
        categories: Array,
        assets_count: String,
        video_duration: String,
        start_time: String,
        displays: Array,
        end_time: String,
        week_days: Array,
        created_on: {
            type: Date,
            "default": Date.now
        }
    }, {
        strict: false
    });


    var Schedular = mongoose.model('Schedular', schedularSchema);

    return Schedular;
};
