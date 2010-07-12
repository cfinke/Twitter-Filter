rm -rf `find ./ -name ".DS_Store"`
rm -rf `find ./ -name "Thumbs.db"`
rm twitterfilter.xpi
rm -rf .tmp_xpi_dir/

chmod -R 0777 twitterfilter/

mkdir .tmp_xpi_dir/
cp -r twitterfilter/* .tmp_xpi_dir/
rm -rf `find ./.tmp_xpi_dir/ -name ".svn"`

cd .tmp_xpi_dir/chrome/
zip -rq ../twitterfilter.jar *
rm -rf *
mv ../twitterfilter.jar ./
cd ../
zip -rq ../twitterfilter.xpi *
cd ../
rm -rf .tmp_xpi_dir/
cp twitterfilter.xpi ~/Desktop/