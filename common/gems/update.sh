if [ ! -d "./common/gems/$1" ] ; then
  git clone git@github.com:verse-rb/$1.git ./common/gems/$1
else
  cd ./common/gems/$1 && git pull
fi
