![GitHub release](https://img.shields.io/github/release-date/mclemente/fvtt-karma)
![GitHub Releases](https://img.shields.io/github/downloads/mclemente/fvtt-karma/latest/module.zip)

# Karmic Dice

Keep a history of dice rolls per user and, if they don't meet a threshold over a defined history, adjust its result based on how you configure it.

This module supports all dice rolls from d2 to d100, either rolling under or over the threshold.

## How to Use

You can set the configurations on the Karma Configuration menu on the game settings.

Simple Karma: if all the previous N rolls are below the threshold, the following roll will be adjusted to a set value.

Average Karma: it the average of the previous N rolls is below the threshold, it will adjust the roll by incrementing a set value until the threshold is reached. The adjusment can be fixed (1, 1, 1...) or cumulative (1, 2, 3...).

# Attribution

This project is a fork of [Die Hard](https://github.com/UranusBytes/foundry-die-hard), made by Uranus Bytes AKA Jeremy.
