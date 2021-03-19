const FIREBASE_CONFIG = null;
const getRandomBool = () => {
  return Boolean(Math.floor(Math.random() * 2));
};

const posEquals = (left, right) => {
  return left.row == right.row && left.col == right.col;
};

const verifyArray = (arr) => {
  let i = 0;
  for (; i < arr.length; i++) {
    if (arr[i] != undefined) {
      break;
    }
  }

  let foundUndefined = false;
  for (i++; i < arr.length; i++) {
    if (arr[i] == undefined) {
      foundUndefined = true;
      continue;
    }

    if (foundUndefined) {
      console.log(`INVALID ARRAY: ${arr}, at index: ${i}, value: ${arr[i]}`);
      break;
    }
  }
};

const arraysDifferent = (left, right) => {
  if (left.length != right.length) {
    return true;
  }

  for (let i = 0; i < left.length; i++) {
    if (left[i] != right[i]) {
      return true;
    }
  }

  return false;
};

document.addEventListener("DOMContentLoaded", () => {
  new Vue({
    el: "#app",
    data: () => {
      return {
        tilesFree: 0,
        dimension: 4,
        tileValues: [],
        score: 0,
        // set to undefined so we know when to call firebase (only in created())
        highScore: undefined,
        gameOver: true,
        message: "",
        name: "",
        firestore: null,
        highScoreChanged: false,
      };
    },
    methods: {
      getRandom: function () {
        return Math.floor(Math.random() * this.dimension);
      },
      getRandomPos: function () {
        return { row: this.getRandom(), col: this.getRandom() };
      },
      moveArrayLeft: function (arr) {
        let result = arr.filter((value) => value != undefined);
        for (let i = result.length; i < this.dimension; i++) {
          result.push(undefined);
        }

        return result;
      },
      moveArrayRight: function (arr) {
        let result = arr.filter((value) => value != undefined);
        for (let i = result.length; i < this.dimension; i++) {
          result.unshift(undefined);
        }

        return result;
      },
      forEachColumn: function (arr, callback) {
        for (let col = 0; col < this.dimension; col++) {
          let colArray = [];
          for (let row = 0; row < this.dimension; row++) {
            const tileValue = arr[row][col];
            if (tileValue != undefined) {
              colArray.push(tileValue);
            }
          }

          if (colArray.length == 0) {
            continue;
          }

          callback(col, colArray);
        }
      },
      isGameEnabled: function () {
        if (this.$refs.name == undefined) {
          return false;
        }

        return !this.gameOver && this.$refs.name.value.length != 0;
      },
      initGame: async function () {
        this.$refs.name.disabled = "disabled";
        this.message = "Playing game...";
        this.score = 0;
        this.gameOver = false;
        this.tilesFree = this.dimension ** 2;
        this.highScoreChanged = false;

        // Only load highScore from the database the *first* time we're called,
        // not on every restart.

        if (this.highScore == undefined) {
          if (this.firestore != null) {
            this.highScore = "Loading...";
            try {
              let doc = await this.firestore
                .collection("highScores")
                .doc(this.$refs.name.value)
                .get();

              this.highScore = doc.data().score;
            } catch (err) {
              this.firestore
                .collection("highScores")
                .doc(this.$refs.name.value)
                .set({});

              this.highScore = 0;
            }
          } else {
            this.highScore = 0;
          }
        }

        this.tileValues.forEach((row, rowIndex) => {
          const newRow = [];
          for (let i = 0; i < this.dimension; i++) {
            newRow.push(undefined);
          }

          this.setRow(rowIndex, newRow);
        });

        let tileRand1 = null;
        let tileRand2 = null;

        do {
          tileRand1 = this.getRandomPos();
          tileRand2 = this.getRandomPos();
        } while (posEquals(tileRand1, tileRand2));

        this.setTileAtPos(tileRand1.row, tileRand1.col, 2);
        this.setTileAtPos(tileRand2.row, tileRand2.col, 2);
      },
      autoPlay: function () {
        const actions = [this.goUp, this.goDown, this.goLeft, this.goRight];
        while (!this.gameOver) {
          actions[getRandom()]();
          this.handlePostAction();
        }
      },
      combineArrayLeft: function (obj) {
        let result = 0;
        for (let i = 0; i < this.dimension - 1; i++) {
          const left = obj.arr[i];
          const right = obj.arr[i + 1];

          if (left == undefined || right == undefined) {
            continue;
          }

          if (left != right) {
            continue;
          }

          const newValue = left * 2;

          obj.arr[i] = `${newValue}`;
          obj.arr[i + 1] = undefined;

          obj.arr = this.moveArrayLeft(obj.arr);
          this.tilesFree++;

          result += newValue;
        }

        return result;
      },
      combineArrayRight: function (obj) {
        let result = 0;
        for (let i = this.dimension - 1; i > 0; i--) {
          const left = obj.arr[i];
          const right = obj.arr[i - 1];

          if (left == undefined || right == undefined) {
            continue;
          }

          if (left != right) {
            continue;
          }

          const newValue = left * 2;

          obj.arr[i] = newValue;
          obj.arr[i - 1] = undefined;

          obj.arr = this.moveArrayRight(obj.arr);
          this.tilesFree++;

          result += newValue;
        }

        return result;
      },
      generateNewTile: function () {
        let newPos = null;
        do {
          newPos = this.getRandomPos();
        } while (this.tileValues[newPos.row][newPos.col] != undefined);

        this.setTileAtPos(newPos.row, newPos.col, getRandomBool() ? 2 : 4);
      },
      writeColArray: function (col, colArray) {
        for (let row = 0; row < this.dimension; row++) {
          this.writeIndex(row, col, colArray[row]);
        }
      },
      goUp: function () {
        var movedTiles = false;
        this.forEachColumn(this.tileValues, (col, colArray) => {
          let result = { arr: this.moveArrayLeft(colArray) };
          this.score += this.combineArrayLeft(result);

          if (arraysDifferent(colArray, result.arr)) {
            movedTiles = true;
          }

          verifyArray(result.arr);
          this.writeColArray(col, result.arr);
        });

        if (movedTiles) {
          this.generateNewTile();
        }
      },
      goDown: function () {
        var movedTiles = false;
        this.forEachColumn(this.tileValues, (col, colArray) => {
          let result = { arr: this.moveArrayRight(colArray) };
          this.score += this.combineArrayRight(result);

          if (arraysDifferent(colArray, result.arr)) {
            movedTiles = true;
          }

          verifyArray(result.arr);
          this.writeColArray(col, result.arr);
        });

        if (movedTiles) {
          this.generateNewTile();
        }
      },
      goLeft: function () {
        var movedTiles = false;
        this.tileValues.forEach((row, index) => {
          let result = { arr: this.moveArrayLeft(row) };
          this.score += this.combineArrayLeft(result);

          if (arraysDifferent(row, result.arr)) {
            movedTiles = true;
          }

          verifyArray(result.arr);
          this.setRow(index, result.arr);
        });

        if (movedTiles) {
          this.generateNewTile();
        }
      },
      goRight: function () {
        var movedTiles = false;
        this.tileValues.forEach((row, index) => {
          let result = { arr: this.moveArrayRight(row) };
          this.score += this.combineArrayRight(result);

          if (arraysDifferent(row, result.arr)) {
            movedTiles = true;
          }

          verifyArray(result.arr);
          this.setRow(index, result.arr);
        });

        if (movedTiles) {
          this.generateNewTile();
        }
      },
      getTileClass: function (row, col) {
        const val = this.tileValues[row][col];
        if (val != undefined) {
          return `tile tile-${val}`;
        }

        return "tile-empty";
      },
      setTileAtPos: function (row, col, val) {
        this.writeIndex(row, col, val);
        this.tilesFree--;
      },
      writeIndex: function (row, col, value) {
        // Reactive 2d array-setting in Vue
        // https://stackoverflow.com/a/45644966

        const newRow = this.tileValues[row].slice(0);
        newRow[col] = value;

        this.setRow(row, newRow);
      },
      setRow: function (row, newRow) {
        // Reactive 2d array-setting in Vue
        // https://stackoverflow.com/a/45644966

        this.$set(this.tileValues, row, newRow);
      },
      checkIfGameOver: function () {
        if (this.tilesFree != 0) {
          return;
        }

        const posCanMove = (row, col) => {
          const value = this.tileValues[row][col];
          if (row != 0) {
            const topValue = this.tileValues[row - 1][col];
            if (value == topValue) {
              return true;
            }
          }

          if (col != 0) {
            const leftValue = this.tileValues[row][col - 1];
            if (value == leftValue) {
              return true;
            }
          }

          if (col != this.dimension - 1) {
            const rightValue = this.tileValues[row][col + 1];
            if (value == rightValue) {
              return true;
            }
          }

          if (row != this.dimension - 1) {
            const bottomValue = this.tileValues[row + 1][col];
            if (value == bottomValue) {
              return true;
            }
          }

          return false;
        };

        let canMove = false;
        this.tileValues.forEach((row, rowIndex) => {
          for (let col = 0; col !== this.dimension; col++) {
            if (posCanMove(rowIndex, col)) {
              canMove = true;
            }
          }
        });

        if (canMove) {
          return;
        }

        this.gameOver = true;
        this.message = "Game Over!";
        this.$refs.startButton.innerText = "Restart Game";
        if (!this.highScoreChanged) {
          return;
        }

        if (this.firestore == null) {
          return;
        }

        this.firestore.collection("highScores").doc(this.$refs.name.value).set(
          {
            score: this.highScore,
            date_created: new Date(),
          },
          { merge: true }
        );
      },
      handlePostAction: function () {
        if (this.highScore < this.score) {
          this.highScore = this.score;
          this.highScoreChanged = true;
        }

        this.checkIfGameOver();
      },
    },
    created: function () {
      // Initialize Firebase
      if (FIREBASE_CONFIG != null) {
        firebase.initializeApp(FIREBASE_CONFIG);
        this.firestore = firebase.firestore();
      }

      for (let i = 0; i < this.dimension; i++) {
        this.tileValues.push([]);
      }
    },
    mounted: function () {
      window.addEventListener("keydown", (e) => {
        if (!this.isGameEnabled()) {
          return;
        }

        switch (e.code) {
          case "ArrowUp":
            this.goUp();
            break;
          case "ArrowDown":
            this.goDown();
            break;
          case "ArrowLeft":
            this.goLeft();
            break;
          case "ArrowRight":
            this.goRight();
            break;
          default:
            return;
        }

        this.handlePostAction();
      });
    },
  });
});
